"""Generates seamless ambient loops (original, license-free) with the standard library only.

Usage: python3 make_sounds.py <out_dir>
"""
import math
import random
import struct
import sys
import wave

RATE = 22050
FADE = RATE  # 1 s crossfade so the loop has no seam


def seamless(samples):
    """Crossfade the tail into the head, then drop the tail."""
    body, tail = samples[:-FADE], samples[-FADE:]
    for i in range(FADE):
        t = i / FADE
        body[i] = body[i] * t + tail[i] * (1 - t)
    return body


def normalise(samples, peak=0.6):
    m = max(abs(s) for s in samples) or 1.0
    return [s / m * peak for s in samples]


def write(path, samples):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 32767)) for s in samples))


def brown(seconds):
    rnd = random.Random(7)
    out, b = [], 0.0
    for _ in range(seconds * RATE + FADE):
        b = (b + 0.02 * rnd.uniform(-1, 1)) / 1.02
        out.append(b)
    # Remove slow DC drift with a gentle high-pass.
    hp, prev_in, prev_out = [], 0.0, 0.0
    a = 0.9995
    for x in out:
        y = a * (prev_out + x - prev_in)
        prev_in, prev_out = x, y
        hp.append(y)
    return normalise(seamless(hp), 0.55)


def rain(seconds):
    rnd = random.Random(11)
    n = seconds * RATE + FADE
    # Pink-ish noise (Paul Kellet's economy filter), then a soft low-pass: the steady hiss of rain.
    b0 = b1 = b2 = 0.0
    lp = 0.0
    bed = []
    for _ in range(n):
        w = rnd.uniform(-1, 1)
        b0 = 0.99765 * b0 + w * 0.0990460
        b1 = 0.96300 * b1 + w * 0.2965164
        b2 = 0.57000 * b2 + w * 1.0526913
        pink = b0 + b1 + b2 + w * 0.1848
        lp += 0.35 * (pink - lp)
        bed.append(lp)
    bed = normalise(bed, 0.35)
    # Droplets: short, decaying bursts of bright noise at random times.
    for _ in range(seconds * 14):
        start = rnd.randrange(0, n - 2000)
        length = rnd.randrange(300, 1400)
        amp = rnd.uniform(0.04, 0.16)
        for i in range(length):
            bed[start + i] += amp * math.exp(-i / (length / 5)) * rnd.uniform(-1, 1)
    return normalise(seamless(bed), 0.6)


def lofi(bars=8, bpm=75):
    """A mellow lofi loop: Rhodes-like chords (IV-iii-ii-I in C), bass, soft swung drums, vinyl crackle."""
    rnd = random.Random(5)
    beat = 60 / bpm
    length = int(bars * 4 * beat * RATE)
    tail = int(3 * RATE)
    buf = [0.0] * (length + tail)

    def add(start_s, samples, gain):
        i0 = int(start_s * RATE)
        for i, v in enumerate(samples):
            buf[i0 + i] += v * gain

    def keys(freq, dur):
        n = int(dur * RATE)
        out = []
        for i in range(n):
            t = i / RATE
            env = (1 - math.exp(-t / 0.006)) * math.exp(-t / 1.3)
            if t > dur - 0.06:  # short release so notes don't click
                env *= max(0.0, (dur - t) / 0.06)
            trem = 1 + 0.12 * math.sin(2 * math.pi * 4.2 * t)
            tone = (math.sin(2 * math.pi * freq * t)
                    + 0.22 * math.exp(-t / 0.4) * math.sin(2 * math.pi * 2 * freq * t)
                    + 0.08 * math.exp(-t / 0.05) * math.sin(2 * math.pi * 4 * freq * t))  # bell-like tine
            out.append(tone * env * trem)
        return out

    def bass(freq, dur):
        n = int(dur * RATE)
        return [math.sin(2 * math.pi * freq * i / RATE) * (1 - math.exp(-i / RATE / 0.01)) * math.exp(-i / RATE / 0.9)
                * min(1.0, (dur - i / RATE) / 0.05) for i in range(n)]

    def kick():
        out, phase = [], 0.0
        for i in range(int(0.35 * RATE)):
            t = i / RATE
            phase += 2 * math.pi * (48 + 70 * math.exp(-t / 0.03)) / RATE
            out.append(math.sin(phase) * math.exp(-t / 0.14))
        return out

    def snare():
        out, lp1, lp2 = [], 0.0, 0.0
        for i in range(int(0.25 * RATE)):
            t = i / RATE
            w = rnd.uniform(-1, 1)
            lp1 += 0.45 * (w - lp1)
            lp2 += 0.08 * (w - lp2)
            out.append(((lp1 - lp2) * 1.6 + 0.35 * math.sin(2 * math.pi * 185 * t)) * math.exp(-t / 0.07))
        return out

    def hat():
        out, lp = [], 0.0
        for i in range(int(0.06 * RATE)):
            w = rnd.uniform(-1, 1)
            lp += 0.5 * (w - lp)
            out.append((w - lp) * math.exp(-i / RATE / 0.018))
        return out

    chords = [  # (bass root, chord tones) in Hz
        (87.31, [174.61, 220.00, 261.63, 329.63]),  # Fmaj7
        (82.41, [164.81, 196.00, 246.94, 293.66]),  # Em7
        (73.42, [146.83, 174.61, 220.00, 261.63]),  # Dm7
        (65.41, [130.81, 164.81, 196.00, 246.94]),  # Cmaj7
    ]
    swing = 0.58  # the off-beat lands a little late
    k, sn = kick(), snare()
    for bar in range(bars):
        root, tones = chords[bar % 4]
        t0 = bar * 4 * beat
        for j, f in enumerate(tones):  # slightly rolled chord, like a lazy hand
            add(t0 + 0.012 * j + rnd.uniform(0, 0.01), keys(f, 4 * beat - 0.05), 0.2)
            add(t0 + (2 + swing) * beat + 0.012 * j, keys(f, (2 - swing) * beat), 0.09)
        if bar >= 4:  # second half: a few soft high notes from the chord
            for b, f in ((1 + swing, tones[2] * 2), (3, tones[3] * 2)):
                add(t0 + b * beat, keys(f, beat * 0.9), 0.07)
        add(t0, bass(root, 2 * beat), 0.42)
        add(t0 + (2 + swing) * beat, bass(root, (2 - swing) * beat), 0.32)
        for b in (0, 2 + swing) + ((1 + swing,) if bar % 2 else ()):
            add(t0 + b * beat, k, 0.55)
        for b in (1, 3):
            add(t0 + b * beat + rnd.uniform(0, 0.012), sn, 0.22)
        for e in range(8):
            b = e // 2 + (swing if e % 2 else 0)
            add(t0 + b * beat, hat(), 0.05 if e % 2 else 0.08)

    # Seamless: the tail that rings past the end plays over the start.
    for i in range(tail):
        buf[i] += buf[length + i]
    mix = buf[:length]
    # Warm, slightly muffled lofi tone: one-pole low-pass around 3.2 kHz.
    a = 1 - math.exp(-2 * math.pi * 3200 / RATE)
    y = 0.0
    for i, x in enumerate(mix):
        y += a * (x - y)
        mix[i] = y
    mix = normalise(mix, 0.62)
    # Vinyl crackle on top.
    for i in range(length):
        mix[i] += rnd.uniform(-1, 1) * 0.006
    for _ in range(int(bars * 4 * beat * 9)):
        i = rnd.randrange(0, length - 40)
        amp = rnd.uniform(0.02, 0.07) * rnd.choice((-1, 1))
        for j in range(30):
            mix[i + j] += amp * math.exp(-j / 6)
    return mix


if __name__ == '__main__':
    out = sys.argv[1]
    write(f'{out}/rain.wav', rain(30))
    write(f'{out}/brown-noise.wav', brown(20))
    write(f'{out}/lofi-beat.wav', lofi())
    print('ok')
