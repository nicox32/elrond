"""Sons du téléphone NeonCell (synthèse) : python3 scripts/make_sfx.py assets/sfx"""
import os, subprocess, sys, tempfile, wave
import numpy as np

SR = 44100

def tone(f, d, kind='sine', decay=6.0, vol=1.0):
    t = np.arange(int(d * SR)) / SR
    if kind == 'sine':
        s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 10)
    else:
        s = np.sign(np.sin(2 * np.pi * f * t)) * 0.5
    a = np.minimum(1, t / 0.004)
    return s * a * np.exp(-t * decay) * vol

def seq(notes, gap):
    out = np.zeros(int((gap * len(notes) + 1.0) * SR))
    for i, (f, d) in enumerate(notes):
        s = tone(f, d)
        j = int(i * gap * SR)
        out[j:j + len(s)] += s
    return out

def save(sig, path):
    sig = np.trim_zeros(np.where(np.abs(sig) < 1e-4, 0, sig), 'b')
    sig = sig / (np.max(np.abs(sig)) + 1e-9) * 0.8
    fd, wav = tempfile.mkstemp(suffix='.wav'); os.close(fd)
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sig * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '96k', path], check=True)
    os.remove(wav)

N = lambda m: 440 * 2 ** ((m - 69) / 12)

def main(out):
    os.makedirs(out, exist_ok=True)
    save(seq([(N(84), 0.5), (N(91), 0.7)], 0.11), f'{out}/notif.m4a')
    t = np.arange(int(0.16 * SR)) / SR
    f = 500 + 900 * t / t[-1]
    save(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18), f'{out}/sent.m4a')
    ring = seq([(N(76), 0.25), (N(79), 0.25), (N(84), 0.25), (N(79), 0.25), (N(83), 0.3), (N(86), 0.6)], 0.17)
    ring = np.concatenate([ring[: int(1.6 * SR)], np.zeros(int(0.8 * SR))])
    save(ring, f'{out}/ring.m4a')
    save(seq([(N(72), 0.3), (N(76), 0.3), (N(79), 0.3), (N(84), 0.9)], 0.1), f'{out}/win.m4a')
    save(seq([(N(67), 0.35), (N(63), 0.35), (N(58), 0.9)], 0.18), f'{out}/fail.m4a')
    t = np.arange(int(1.2 * SR)) / SR
    f = 700 + 350 * np.sign(np.sin(2 * np.pi * 2.5 * t))
    save(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, (1.2 - t) * 4), f'{out}/siren.m4a')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'assets/sfx')
