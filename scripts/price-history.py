"""Historique des cours en euros par gramme (or, argent, platine) sur 20 ans, pour les graphiques de l'appli.

Cours quotidiens en dollars par once (Stooq, sinon Yahoo) convertis au taux euro/dollar de la BCE du même jour.
Sortie JSON compacte : jours (nombre de jours depuis le 1er janvier 1970) et cours en €/g. Les 2 dernières années
sont gardées jour par jour, les précédentes une fois par semaine (dernier cours de la semaine).
Usage : python3 scripts/price-history.py cours.json"""
import csv, datetime as dt, io, json, sys, time, urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else "cours.json"
TODAY = dt.date.today()
START = dt.date(TODAY.year - 20, 1, 1)
OZ = 31.1034768
UA = {"User-Agent": "Mozilla/5.0 (compatible; orvia-build)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read().decode()


def stooq(sym):
    text = get(f"https://stooq.com/q/d/l/?s={sym}&d1={START:%Y%m%d}&d2={TODAY:%Y%m%d}&i=d")
    return {r["Date"]: float(r["Close"]) for r in csv.DictReader(io.StringIO(text)) if r.get("Close") not in (None, "", "null")}


def yahoo(sym):
    p1 = int(time.mktime(START.timetuple()))
    data = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1={p1}&period2=9999999999&interval=1d"))
    res = data["chart"]["result"][0]
    return {time.strftime("%Y-%m-%d", time.gmtime(t)): float(c) for t, c in zip(res["timestamp"], res["indicators"]["quote"][0]["close"]) if c is not None}


def metal(s, y):
    for name, fn in (("stooq", lambda: stooq(s)), ("yahoo", lambda: yahoo(y))):
        try:
            d = fn()
            if len(d) > 2000:
                print(f"# {s}: {name}, {len(d)} jours, du {min(d)} au {max(d)}", file=sys.stderr)
                return d, name
            print(f"# {s}: {name} trop court ({len(d)})", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"# {s}: {name} indisponible ({e})", file=sys.stderr)
    raise SystemExit(f"Aucune source pour {s}")


fx = {k: v["EUR"] for k, v in json.loads(get(f"https://api.frankfurter.dev/v1/{START}..?base=USD&symbols=EUR"))["rates"].items()}
fx_days = sorted(fx)


def fx_on(day):
    lo, hi = 0, len(fx_days) - 1
    if day < fx_days[0]:
        return fx[fx_days[0]]
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if fx_days[mid] <= day:
            lo = mid
        else:
            hi = mid - 1
    return fx[fx_days[lo]]


series, sources = {}, {}
for key, s, y in (("g", "xauusd", "GC=F"), ("s", "xagusd", "SI=F"), ("p", "xptusd", "PL=F")):
    series[key], sources[key] = metal(s, y)

# Jours où l'or est coté ; argent et platine : dernier cours connu si un jour manque.
days = sorted(d for d in series["g"] if str(START) <= d <= str(TODAY))
last = {"s": None, "p": None}
rows = []
for d in days:
    for k in ("s", "p"):
        if d in series[k]:
            last[k] = series[k][d]
    if last["s"] is None or last["p"] is None:
        continue
    rate = fx_on(d) / OZ
    rows.append((d, series["g"][d] * rate, last["s"] * rate, last["p"] * rate))

cut = str(TODAY - dt.timedelta(days=730))
kept = []
for i, r in enumerate(rows):
    if r[0] >= cut:
        kept.append(r)
        continue
    nxt = rows[i + 1][0] if i + 1 < len(rows) else None
    # Dernier jour coté de la semaine ISO.
    if nxt is None or dt.date.fromisoformat(nxt).isocalendar()[:2] != dt.date.fromisoformat(r[0]).isocalendar()[:2]:
        kept.append(r)

epoch = dt.date(1970, 1, 1)
out = {
    "updated": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "sources": sources,
    "d": [(dt.date.fromisoformat(r[0]) - epoch).days for r in kept],
    "g": [round(r[1], 2) for r in kept],
    "s": [round(r[2], 4) for r in kept],
    "p": [round(r[3], 2) for r in kept],
}
with open(OUT, "w") as f:
    json.dump(out, f, separators=(",", ":"))
print(f"{len(kept)} points, du {kept[0][0]} au {kept[-1][0]}, dernier or {kept[-1][1]:.2f} €/g, ratio {kept[-1][1] / kept[-1][2]:.1f}")
