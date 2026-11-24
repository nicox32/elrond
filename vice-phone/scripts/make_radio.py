"""Compose les boucles musicales originales des radios de NeonCell (synthèse procédurale, aucun échantillon).

Usage : python3 scripts/make_radio.py assets/radio
Chaque station produit un fichier .m4a (AAC, stéréo 44,1 kHz) d’environ 45 à 60 secondes qui boucle.
"""

import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.005, d=0.1, s=0.6, r=0.1, length=None):
    """Enveloppe ADSR de n échantillons."""
    length = n if length is None else length
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    e = np.full(n, s, dtype=np.float64)
    e[: min(a_n, n)] = np.linspace(0, 1, min(a_n, n), endpoint=False)
    if a_n < n:
        k = min(d_n, n - a_n)
        e[a_n : a_n + k] = np.linspace(1, s, k, endpoint=False)
    if r_n and n > r_n:
        e[-r_n:] *= np.linspace(1, 0, r_n)
    return e


def osc(freq, n, kind='saw', detune=0.0):
    t = np.arange(n) / SR
    ph = t * freq * (1 + detune)
    if kind == 'sine':
        return np.sin(2 * np.pi * ph)
    if kind == 'square':
        return np.sign(np.sin(2 * np.pi * ph)) * 0.7
    if kind == 'tri':
        return 2 * np.abs(2 * (ph % 1) - 1) - 1
    return 2 * (ph % 1) - 1  # saw


def lowpass_fast(x, cutoff):
    # Version vectorisée approximative (moyenne glissante) pour les longs signaux.
    k = max(1, int(SR / cutoff / 2))
    kernel = np.ones(k) / k
    return np.convolve(np.convolve(x, kernel, 'same'), kernel, 'same')


def highpass(x, cutoff):
    return x - lowpass_fast(x, cutoff)


class Track:
    def __init__(self, bpm, bars, beats_per_bar=4):
        self.bpm = bpm
        self.beat = 60 / bpm
        self.n = int(bars * beats_per_bar * self.beat * SR)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def at(self, beat):
        return int(beat * self.beat * SR)

    def add(self, sig, beat, gain=1.0, pan=0.0):
        i = self.at(beat)
        if i >= self.n:
            return
        sig = sig[: self.n - i]
        self.L[i : i + len(sig)] += sig * gain * (1 - max(0, pan))
        self.R[i : i + len(sig)] += sig * gain * (1 + min(0, pan))

    # --- instruments ---
    def kick(self, beat, gain=1.0, punch=1.0):
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        f = 45 + 110 * np.exp(-t * 30 * punch)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
        self.add(s, beat, gain)

    def k808(self, beat, note, length=1.0, gain=0.9):
        n = int(length * self.beat * SR)
        t = np.arange(n) / SR
        f = midi(note) * (1 + 1.5 * np.exp(-t * 40))
        s = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * env(n, 0.002, 0.3, 0.7, 0.08)
        self.add(s, beat, gain)

    def snare(self, beat, gain=0.6, tone=190, decay=14):
        n = int(0.25 * SR)
        t = np.arange(n) / SR
        noise = highpass(rng.standard_normal(n), 1200) * np.exp(-t * decay)
        body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 25)
        self.add(0.7 * noise + 0.5 * body, beat, gain)

    def clap(self, beat, gain=0.5):
        n = int(0.2 * SR)
        t = np.arange(n) / SR
        e = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.01, 0.022))
        s = highpass(rng.standard_normal(n), 1500) * (e + np.exp(-t * 18) * 0.6)
        self.add(s, beat, gain)

    def hat(self, beat, gain=0.18, open_=False, pan=0.25):
        n = int((0.18 if open_ else 0.05) * SR)
        t = np.arange(n) / SR
        s = highpass(rng.standard_normal(n), 7000) * np.exp(-t * (12 if open_ else 70))
        self.add(s, beat, gain, pan)

    def shaker(self, beat, gain=0.08):
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        s = highpass(rng.standard_normal(n), 5000) * np.sin(np.pi * t / t[-1])
        self.add(s, beat, gain, -0.3)

    def synth(self, beat, notes, length, kind='saw', gain=0.12, cutoff=2500, a=0.01, d=0.2, s=0.6, r=0.2, pan=0.0, detune=0.004):
        n = int(length * self.beat * SR) + int(r * SR)
        sig = np.zeros(n)
        for note in np.atleast_1d(notes):
            f = midi(note)
            sig += osc(f, n, kind) + osc(f, n, kind, detune) * 0.8
        sig = lowpass_fast(sig, cutoff) * env(n, a, d, s, r)
        self.add(sig, beat, gain, pan)

    def pluck(self, beat, note, gain=0.12, kind='square', cutoff=3000, decay=8, pan=0.0):
        n = int(0.6 * SR)
        t = np.arange(n) / SR
        sig = lowpass_fast(osc(midi(note), n, kind), cutoff) * np.exp(-t * decay)
        self.add(sig, beat, gain, pan)

    def keys(self, beat, notes, length, gain=0.1, pan=0.0):
        """Piano électrique doux (sinus + harmonique, trémolo)."""
        n = int(length * self.beat * SR) + int(0.3 * SR)
        t = np.arange(n) / SR
        sig = np.zeros(n)
        for note in notes:
            f = midi(note)
            sig += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)
        sig *= np.exp(-t * 1.2) * (1 + 0.15 * np.sin(2 * np.pi * 5 * t)) * env(n, 0.005, 0.1, 1, 0.3)
        self.add(sig, beat, gain, pan)

    def finish(self, path, echo=0.0, echo_beats=0.75, lofi=False, vinyl=0.0, waves=0.0):
        L, R = self.L, self.R
        if echo:
            d = self.at(echo_beats)
            for src, dst in ((L, R), (R, L)):
                tmp = np.zeros_like(src)
                tmp[d:] = src[:-d] * echo
                tmp[2 * d :] += src[: -2 * d] * echo * 0.5
                dst += lowpass_fast(tmp, 3000)
        if vinyl:
            crackle = (rng.random(self.n) > 0.9993) * rng.standard_normal(self.n) * 0.4
            hiss = lowpass_fast(rng.standard_normal(self.n), 3000) * 0.015
            L += (crackle + hiss) * vinyl
            R += (crackle + hiss) * vinyl
        if waves:
            t = np.arange(self.n) / SR
            swell = (0.5 + 0.5 * np.sin(2 * np.pi * t / 7.5)) ** 2
            noise = lowpass_fast(rng.standard_normal(self.n), 900)
            L += noise * swell * waves
            R += np.roll(noise, 4000) * swell * waves
        if lofi:
            L, R = lowpass_fast(L, 5500), lowpass_fast(R, 5500)
        # Fondu de bouclage : la fin rejoint doucement le début.
        f = int(0.03 * SR)
        for ch in (L, R):
            ch[:f] *= np.linspace(0, 1, f)
            ch[-f:] *= np.linspace(1, 0, f)
        st = np.stack([L, R], axis=1)
        st = np.tanh(st / (np.max(np.abs(st)) + 1e-9) * 1.4) * 0.89
        pcm = (st * 32767).astype(np.int16)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            wav = tmp.name
        with wave.open(wav, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '112k', path], check=True)
        os.remove(wav)


# Accords : (fondamentale midi, type)
def chord(root, kind='min', octave_up=0):
    iv = {'min': [0, 3, 7, 10], 'maj': [0, 4, 7, 11], 'sus': [0, 5, 7, 10], 'min7': [0, 3, 7, 10, 14]}[kind]
    return [root + i + 12 * octave_up for i in iv]


def neon_fm(path):
    """Synthwave : batterie lourde, basse en croches, nappes et arpège."""
    tr = Track(bpm=100, bars=24)
    prog = [(57, 'min'), (53, 'maj'), (48, 'maj'), (55, 'maj')]  # Am F C G
    for bar in range(24):
        root, kind = prog[bar % 4]
        b0 = bar * 4
        intro = bar < 2
        outro = bar >= 22
        tr.synth(b0, chord(root, kind), 4, gain=0.1, cutoff=2200, a=0.3, s=0.9, r=0.4, pan=-0.2)
        for i in range(8):
            tr.synth(b0 + i * 0.5, root - 24, 0.45, gain=0.16, cutoff=600, a=0.003, d=0.1, s=0.5, r=0.05)
        if not intro:
            arp = chord(root, kind, 1)
            for i in range(16):
                tr.pluck(b0 + i * 0.25, arp[i % 4] + (12 if i % 8 >= 4 else 0), gain=0.09, kind='saw', cutoff=3500, decay=10, pan=0.35)
        if not intro and not outro:
            for beat in range(4):
                tr.kick(b0 + beat, 0.9)
                tr.hat(b0 + beat + 0.5, 0.045, open_=True)
            tr.snare(b0 + 1, 0.4, tone=180, decay=12)
            tr.snare(b0 + 3, 0.4, tone=180, decay=12)
        if 8 <= bar < 20:
            mel = [69, 72, 76, 74, 72, 71, 69, 67][bar % 8]
            tr.synth(b0, mel + 12, 1.5, kind='square', gain=0.08, cutoff=2500, a=0.02, r=0.3, pan=0.1)
            tr.synth(b0 + 2, mel + 7, 1.5, kind='square', gain=0.07, cutoff=2500, a=0.02, r=0.3, pan=0.1)
    tr.finish(path, echo=0.32, echo_beats=0.75)


def palm_beats(path):
    """Lo-fi chill : piano électrique, batterie au swing, craquements de vinyle."""
    tr = Track(bpm=82, bars=16)
    prog = [(50, 'min7'), (55, 'maj'), (48, 'maj'), (45, 'min7')]  # Dm9 G C Am9
    sw = 0.08
    for bar in range(16):
        root, kind = prog[bar % 4]
        b0 = bar * 4
        tr.keys(b0, chord(root, kind, 1)[:4], 2.5, gain=0.09)
        tr.keys(b0 + 2.5, chord(root, kind, 1)[1:4], 1.5, gain=0.06)
        tr.synth(b0, root - 12, 1.8, kind='sine', gain=0.3, cutoff=400, a=0.01, s=0.8, r=0.1)
        tr.synth(b0 + 2.5, root - 12 + 7, 1.2, kind='sine', gain=0.25, cutoff=400, a=0.01, s=0.8, r=0.1)
        if bar >= 1:
            tr.kick(b0, 0.8, punch=0.6)
            tr.kick(b0 + 2.5 + sw, 0.7, punch=0.6)
            tr.snare(b0 + 1, 0.4, tone=220, decay=20)
            tr.snare(b0 + 3, 0.4, tone=220, decay=20)
            for i in range(8):
                tr.hat(b0 + i * 0.5 + (sw if i % 2 else 0), 0.04 if i % 2 else 0.06)
        if bar % 2 == 1 and bar > 2:
            for i, nt in enumerate([74, 72, 69, 67]):
                tr.pluck(b0 + 0.5 + i * 0.75, nt, gain=0.05, kind='tri', cutoff=2500, decay=4, pan=0.3)
    tr.finish(path, echo=0.2, echo_beats=0.5, lofi=True, vinyl=1.0)


def caliente(path):
    """Rythme latino (dembow), basse, cuivres synthétiques, shaker."""
    tr = Track(bpm=96, bars=24)
    prog = [(50, 'min'), (46, 'maj'), (53, 'maj'), (48, 'maj')]  # Dm Bb F C
    for bar in range(24):
        root, kind = prog[bar % 4]
        b0 = bar * 4
        for beat in range(4):
            tr.kick(b0 + beat, 0.85)
            if bar >= 1:
                tr.snare(b0 + beat + 0.75, 0.3, tone=240, decay=22)
            for i in range(4):
                tr.shaker(b0 + beat + i * 0.25, 0.07 if i else 0.1)
        if bar >= 1:
            for beat in (1.5, 3.5):
                tr.snare(b0 + beat, 0.3, tone=240, decay=22)
        for beat, off in ((0, 0), (1.5, 0), (2, 7), (3, 12)):
            tr.synth(b0 + beat, root - 12 + off, 0.45, kind='square', gain=0.12, cutoff=500, a=0.003, s=0.6, r=0.05)
        if bar >= 4:
            for beat in (0.5, 1.5, 2.5, 3.0):
                tr.synth(b0 + beat, chord(root, kind, 1)[:3], 0.3, kind='saw', gain=0.035, cutoff=2800, a=0.005, d=0.1, s=0.4, r=0.05, pan=0.25)
        if 8 <= bar < 20 and bar % 2 == 0:
            line = [74, 77, 79, 81, 79, 77, 74, 72]
            for i, nt in enumerate(line):
                tr.pluck(b0 + i * 0.5, nt, gain=0.06, kind='tri', cutoff=4000, decay=6, pan=-0.3)
    tr.finish(path, echo=0.15, echo_beats=0.5)


def bass_drive(path):
    """Trap : 808, charleys en rafales, nappe sombre."""
    tr = Track(bpm=140, bars=24)
    roots = [41, 41, 44, 39]  # F Ab Eb
    for bar in range(24):
        b0 = bar * 4
        r = roots[bar % 4]
        tr.synth(b0, [r + 24, r + 27, r + 31], 4, kind='saw', gain=0.035, cutoff=1200, a=0.4, s=0.9, r=0.5, pan=-0.15)
        if bar >= 2:
            tr.k808(b0, r, 1.5)
            tr.k808(b0 + 1.75, r, 0.75)
            tr.k808(b0 + 2.75, r + (3 if bar % 2 else 0), 1.0)
            tr.clap(b0 + 2, 0.4)
            for i in range(16):
                if bar % 4 == 3 and i >= 12:
                    for k in range(3):
                        tr.hat(b0 + i * 0.25 + k / 12, 0.06)
                else:
                    tr.hat(b0 + i * 0.25, 0.07 if i % 2 == 0 else 0.04)
        for i, nt in enumerate([r + 36, r + 39, r + 43, r + 39]):
            tr.pluck(b0 + i, nt, gain=0.045, kind='tri', cutoff=3000, decay=5, pan=0.3)
    tr.finish(path, echo=0.25, echo_beats=0.75)


def les_vagues(path):
    """Ambiance de plage : nappes lentes, vagues, carillon."""
    tr = Track(bpm=70, bars=14)
    prog = [(52, 'maj'), (49, 'min'), (45, 'maj'), (47, 'sus')]
    for bar in range(14):
        root, kind = prog[bar % 4]
        b0 = bar * 4
        tr.synth(b0, chord(root, kind), 4.5, kind='tri', gain=0.07, cutoff=1500, a=1.2, s=0.9, r=1.2)
        tr.synth(b0, root - 12, 4.2, kind='sine', gain=0.2, cutoff=300, a=0.8, s=0.9, r=1.0)
        for i in range(0, 8, 3):
            nt = chord(root, kind, 2)[i % 4]
            tr.pluck(b0 + i * 0.5, nt, gain=0.04, kind='sine', cutoff=6000, decay=2.5, pan=(i % 2) * 0.6 - 0.3)
    tr.finish(path, echo=0.4, echo_beats=1.0, waves=0.035)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'assets/radio'
    os.makedirs(out, exist_ok=True)
    for name, fn in [('neon-fm', neon_fm), ('palm-beats', palm_beats), ('caliente', caliente), ('bass-drive', bass_drive), ('les-vagues', les_vagues)]:
        fn(os.path.join(out, f'{name}.m4a'))
        print('ok', name)
