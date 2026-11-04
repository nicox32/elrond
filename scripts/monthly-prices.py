"""Cours moyens mensuels (€/once) de l'or, de l'argent et du platine depuis 2019, calculés à partir des cours
quotidiens en dollars et du taux euro/dollar quotidien de la BCE. Lancé par .github/workflows/cours-mensuels.yml."""
import csv, io, json, sys, urllib.request
from collections import defaultdict

START, END = "2019-01-01", sys.argv[1] if len(sys.argv) > 1 else "2026-12-31"
UA = {"User-Agent": "Mozilla/5.0 (compatible; orvia-build)"}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read().decode()

def stooq(sym):
    text = get(f"https://stooq.com/q/d/l/?s={sym}&d1={START.replace('-', '')}&d2={END.replace('-', '')}&i=d")
    rows = list(csv.DictReader(io.StringIO(text)))
    return {r["Date"]: float(r["Close"]) for r in rows if r.get("Close") not in (None, "", "null")}

def yahoo(sym):
    import time
    p1 = int(time.mktime(time.strptime(START, "%Y-%m-%d")))
    data = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1={p1}&period2=9999999999&interval=1d"))
    res = data["chart"]["result"][0]
    out = {}
    for t, c in zip(res["timestamp"], res["indicators"]["quote"][0]["close"]):
        if c is not None:
            out[time.strftime("%Y-%m-%d", time.gmtime(t))] = float(c)
    return out

def metal(stooq_sym, yahoo_sym):
    for name, fn in (("stooq", lambda: stooq(stooq_sym)), ("yahoo", lambda: yahoo(yahoo_sym))):
        try:
            d = fn()
            if len(d) > 1000:
                print(f"# {stooq_sym}: {name}, {len(d)} jours", file=sys.stderr)
                return d, name
        except Exception as e:
            print(f"# {stooq_sym}: {name} indisponible ({e})", file=sys.stderr)
    raise SystemExit(f"Aucune source pour {stooq_sym}")

def eurusd():
    d = json.loads(get(f"https://api.frankfurter.dev/v1/{START}..?base=USD&symbols=EUR"))
    return {k: v["EUR"] for k, v in d["rates"].items()}

fx = eurusd()
fx_days = sorted(fx)
def fx_on(day):
    # Taux BCE du jour, ou du dernier jour ouvré précédent.
    lo, hi = 0, len(fx_days) - 1
    if day < fx_days[0]: return fx[fx_days[0]]
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if fx_days[mid] <= day: lo = mid
        else: hi = mid - 1
    return fx[fx_days[lo]]

sources = {}
out = defaultdict(dict)
for key, s, y in (("gold", "xauusd", "GC=F"), ("silver", "xagusd", "SI=F"), ("platinum", "xptusd", "PL=F")):
    daily, src = metal(s, y)
    sources[key] = src
    sums = defaultdict(lambda: [0.0, 0])
    for day, usd in daily.items():
        if START <= day <= END:
            m = day[:7]
            sums[m][0] += usd * fx_on(day)
            sums[m][1] += 1
    for m, (tot, n) in sorted(sums.items()):
        out[m][key] = round(tot / n, 2 if key == "silver" else 1)

print(json.dumps({"sources": sources, "months": dict(sorted(out.items()))}, separators=(",", ":")))
