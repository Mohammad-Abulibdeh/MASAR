"""Makes the promo soundtrack (original music + sound effects + the app's own voice clips) and adds it to the video.

    python sound.py   -> music.wav, then MASAR_promo.mp4 gets the sound (the silent video is kept as MASAR_promo_silent.mp4)

Everything is synthesised here with numpy, so there are no licensing questions. The beat is locked to the
video: one scene (3.1 s) = 2 bars, and the drop lands where the phone rises in (3.6 s).
"""
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
START, LEN, N_SCENES = 3.6, 3.1, 8
END = START + N_SCENES * LEN
DURATION = END + 5.4
BEAT = LEN / 8          # 0.3875 s, about 155 BPM
BAR = BEAT * 4
rng = np.random.default_rng(7)

L = np.zeros(int(DURATION * SR) + SR)
R = np.zeros_like(L)
DUCK = np.ones_like(L)  # pumping under the kick
VOX = np.zeros_like(L)  # where the voice is, so the music steps back


def hz(n):  # MIDI note -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def add(sig, at, gain=1.0, pan=0.0, duck=False):
    """Mixes a mono (or (l, r)) signal in at time `at`; pan -1 left .. 1 right."""
    i = int(at * SR)
    if i < 0:
        sig, i = (sig[-i:] if not isinstance(sig, tuple) else (sig[0][-i:], sig[1][-i:])), 0
    if isinstance(sig, tuple):
        l, r = sig
    else:
        a = (pan + 1) * np.pi / 4
        l, r = sig * np.cos(a) * 1.414, sig * np.sin(a) * 1.414
    n = min(len(l), len(L) - i)
    if n <= 0:
        return
    d = DUCK[i:i + n] if duck else 1
    L[i:i + n] += l[:n] * gain * d
    R[i:i + n] += r[:n] * gain * d


def band(x, lo, hi):
    """Band-pass by FFT mask with soft edges."""
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.clip((f - lo * 0.7) / (lo * 0.3 + 1e-9), 0, 1) * np.clip((hi * 1.4 - f) / (hi * 0.4), 0, 1)
    return np.fft.irfft(np.fft.rfft(x) * m, len(x))


def env(t, a, d):
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def saw(f, t, n=14, det=0.0):
    out = np.zeros_like(t)
    for k in range(1, n + 1):
        if f * k > 9000:
            break
        out += np.sin(2 * np.pi * f * k * t * (1 + det) + k) / k
    return out


def sweep_noise(dur, f0, f1, width=0.6):
    """Noise whose band glides from f0 to f1 (overlap-add of short filtered blocks)."""
    n, blk = int(dur * SR), 2048
    out = np.zeros(n + blk)
    win = np.hanning(blk)
    for s in range(0, n, blk // 2):
        c = f0 * (f1 / f0) ** (s / n)
        out[s:s + blk] += band(rng.standard_normal(blk), c * (1 - width / 2), c * (1 + width)) * win
    return out[:n]


# ---------------------------------------------------------------- instruments
def kick():
    t = tt(0.45)
    f = 48 + 110 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) + band(rng.standard_normal(len(t)), 2000, 7000) * np.exp(-t * 300) * 0.3


def clap():
    t = tt(0.3)
    n = band(rng.standard_normal(len(t)), 900, 5000)
    e = sum(np.exp(-np.maximum(t - o, 0) * 90) * (t >= o) for o in (0, 0.011, 0.022)) * 0.6 + np.exp(-t * 18) * 0.5
    return n * e


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    return band(rng.standard_normal(len(t)), 7000, 16000) * np.exp(-t * (14 if open_ else 70))


def pluck(note, dur=0.5, bright=6):
    t = tt(dur)
    f = hz(note)
    s = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (4 + k * bright)) / k for k in range(1, 9))
    return s * np.minimum(1, t * 400)


def bell(note, dur=1.6):
    t = tt(dur)
    f = hz(note)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.5) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 5)
            + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9)) * np.minimum(1, t * 600)


def bass(note, dur):
    t = tt(dur)
    s = saw(hz(note), t, n=6) * 0.6 + np.sin(2 * np.pi * hz(note) * t)
    return s * np.minimum(1, t * 300) * np.exp(-t * 3) * np.minimum(1, (dur - t) * 60)


def pad(notes, dur, attack=0.6):
    t = tt(dur)
    s = sum(saw(hz(n), t, n=8, det=d) for n in notes for d in (-0.004, 0, 0.005))
    e = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.4)
    return band(s, 150, 2600) * e


def pop(note, pan):
    t = tt(0.14)
    f = hz(note) * (1 + 0.6 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.002, 0.04)


def whoosh(dur=0.6, f0=300, f1=4000):
    t = tt(dur)
    n = sweep_noise(dur, f0, f1)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    pan = np.linspace(-0.8, 0.8, len(t))
    a = (pan + 1) * np.pi / 4
    return (n * e * np.cos(a) * 1.4, n * e * np.sin(a) * 1.4)


def impact():
    t = tt(1.4)
    f = 40 + 80 * np.exp(-t * 12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2) + band(rng.standard_normal(len(t)), 200, 3000) * np.exp(-t * 14) * 0.5


def crash(dur=2.2):
    t = tt(dur)
    return band(rng.standard_normal(len(t)), 4000, 15000) * np.exp(-t * 2.2) * np.minimum(1, t * 800)


def voice(name):
    """Decodes one of the app's voice clips (the user's own recordings) and trims its silence."""
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', str(HERE.parent / 'www' / 'voice' / f'{name}.m4a'),
                          '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(float)
    lvl = np.convolve(np.abs(x), np.ones(480) / 480, 'same')
    on = np.nonzero(lvl > lvl.max() * 0.06)[0]
    x = x[max(0, on[0] - 2400):on[-1] + 4800]
    return x / np.abs(x).max()


# ---------------------------------------------------------------- music
# A minor with the raised 7th (G#): Am F Dm E, a warm, slightly Arabic pop colour. One chord per bar.
CHORDS = [(57, [57, 60, 64]), (53, [53, 57, 60]), (50, [50, 53, 57]), (52, [52, 56, 59])]
HOOK = [76, 74, 72, 71, 72, 74, 76, 79, 77, 76, 74, 72, 71, 68, 69, None]  # 8th notes over two bars
n_bars = int(round((END - START) / BAR))

# Intro: a pad swells under the drawing roads, a soft arp starts once the logo lands.
add(pad([57, 64, 69], START + 0.2, attack=2.0), 0.0, 0.05)
for k in range(int((START - 1.75) / (BEAT / 2))):
    t0 = 1.75 + k * BEAT / 2
    add(pluck([69, 72, 76, 81][k % 4], 0.3), t0, 0.07 * (0.4 + 0.6 * k / 9), pan=(-0.4, 0.4)[k % 2])
add(sweep_noise(1.4, 300, 9000), START - 1.4, 0.10)  # riser into the drop
for k in range(8):  # snare build
    add(clap(), START - BEAT * 2 + k * BEAT / 4, 0.05 + 0.03 * k)

# Main section: two bars per scene.
for b in range(n_bars):
    t0 = START + b * BAR
    root, ch = CHORDS[b % 4]
    for q in range(4):
        tb = t0 + q * BEAT
        i = int(tb * SR)
        dk = 1 - 0.55 * np.exp(-tt(BEAT) * 12)
        DUCK[i:i + len(dk)] = np.minimum(DUCK[i:i + len(dk)], dk)
        add(kick(), tb, 0.85)
        if q in (1, 3):
            add(clap(), tb, 0.32)
        add(hat(open_=(q == 3 and b % 2)), tb + BEAT / 2, 0.16, pan=0.3)
        add(hat(), tb + BEAT / 4, 0.05, pan=-0.3)
        add(hat(), tb + BEAT * 3 / 4, 0.05, pan=-0.3)
    for e8 in range(8):  # bass: root on the beats, octave on the offbeats
        add(bass(root - 12 + (12 if e8 % 2 else 0), BEAT / 2 * 0.9), t0 + e8 * BEAT / 2, 0.26, duck=True)
    for s16 in range(16):  # arp
        n = ch[[0, 1, 2, 1][s16 % 4]] + 12 + (12 if s16 % 8 >= 6 else 0)
        add(pluck(n, 0.25, 9), t0 + s16 * BEAT / 4, 0.055, pan=np.sin(s16 * 0.8) * 0.6, duck=True)
    add(pad([n + 12 for n in ch], BAR + 0.05, attack=0.2), t0, 0.035, duck=True)
    if b % 4 in (2, 3) and b >= 2:  # the hook answers every other pair of bars
        for k, n in enumerate(HOOK[(b % 2) * 8:(b % 2) * 8 + 8]):
            if n:
                add(pluck(n, 0.4, 3), t0 + k * BEAT / 2, 0.09, pan=0.15, duck=True)

# Outro: the beat stops, the chord rings, a last soft hit before the circle closes.
add(crash(), END, 0.22)
add(pad([57, 64, 69, 72], DURATION - END, attack=0.3), END, 0.05)
for k in range(int((DURATION - END - 1.2) / (BEAT / 2))):
    add(pluck([81, 76, 72, 69][k % 4], 0.35), END + 0.4 + k * BEAT / 2, 0.05 * (1 - k / 14), pan=(-0.4, 0.4)[k % 2])
add(bass(45, 3.0), END, 0.25)

# ---------------------------------------------------------------- sound effects on the picture
add(whoosh(1.3, 250, 2500), 0.35, 0.18)                      # the car drives across
add(impact(), 1.72, 0.55)                                    # the logo pops
for n, d in zip((69, 76, 81), (0, 0.04, 0.08)):
    add(bell(n), 1.74 + d, 0.10)
add(sweep_noise(0.6, 2500, 9000), 1.95, 0.05)                # the name writes itself
add(pop(84, 0), 2.35, 0.12)                                  # the tagline jumps in
STICKERS = [[70, 870], [860, 70], [70, 870], [860, 70, 860], [70, 870, 70, 870], [860, 70], [70, 870, 70, 870], [860, 70]]
POP_NOTES = [81, 84, 88, 86]
for i in range(N_SCENES):
    a = START + i * LEN
    if i:
        add(whoosh(0.55, 400, 5000), a - 0.12, 0.22)         # the screen slides over
    add(pop(93, 0), a + 0.12, 0.05)                          # caption lands
    for j, x in enumerate(STICKERS[i]):
        add(pop(POP_NOTES[j % 4], 0), a + 0.5 + j * 0.12, 0.13, pan=(x - 465) / 465 * 0.8)
add(whoosh(0.6, 3000, 300), END - 0.2, 0.2)                  # the phone leaves
add(impact(), END + 0.62, 0.5)                               # outro logo
for n, d in zip((69, 73, 76, 81), (0, 0.05, 0.1, 0.15)):
    add(bell(n), END + 0.64 + d, 0.08)
for i in range(4):
    add(pop(POP_NOTES[i] + 3, 0), END + 1.7 + i * 0.15, 0.12, pan=(-0.6, -0.2, 0.2, 0.6)[i])
add(bell(88, 2.5), END + 2.5, 0.07)                          # "made in Palestine"
add(impact(), DURATION - 0.75, 0.3)                          # the circle closes

# ---------------------------------------------------------------- the app's own voice (the user's recordings)
# Left out on request (music and effects only). To bring the voice back, use for example:
# [('lets_go', START + 2 * LEN + 1.2), ('d200', START + 3 * LEN + 0.55), ('right', None), ('arrived', END + 2.4)]
VOICE = []
VOICE_TRACK = np.zeros_like(L)
prev_end = 0
for name, at in VOICE:
    v = voice(name)
    at = at if at is not None else prev_end + 0.1
    i = int(at * SR)
    n = min(len(v), len(L) - i)
    VOX[i:i + n] = 1
    VOICE_TRACK[i:i + n] += v[:n]
    prev_end = at + len(v) / SR
    print('voice', name, round(at, 2), '->', round(prev_end, 2))

# The music bed is limited gently, steps back under the voice, and fades at the end.
T = int(DURATION * SR)
bed = np.stack([L, R])[:, :T]
bed = np.tanh(bed / np.abs(bed).max() * 1.5) / np.tanh(1.5)
k = np.ones(int(0.15 * SR)) / int(0.15 * SR)
vox = np.minimum(1, np.convolve(VOX, k, 'same') * 1.5)[:T]
mix = bed * 0.62 * (1 - 0.6 * vox) + VOICE_TRACK[:T] * 0.75
on = VOX[:T] > 0
if on.any(): print('voice over music (dB):', round(20 * np.log10(np.sqrt(np.mean(VOICE_TRACK[:T][on] ** 2)) * 0.75
                                                 / np.sqrt(np.mean((bed[:, on] * 0.62 * (1 - 0.6 * vox[on])) ** 2))), 1))
fade = np.ones(T)
fade[-int(0.5 * SR):] = np.linspace(1, 0, int(0.5 * SR)) ** 2
mix *= fade
mix = mix / np.abs(mix).max() * 0.89

wav = HERE / 'music.wav'
pcm = (mix.T * 32767).astype('<i2').tobytes()
with open(wav, 'wb') as f:
    import wave
    w = wave.open(f, 'wb')
    w.setnchannels(2), w.setsampwidth(2), w.setframerate(SR), w.writeframes(pcm), w.close()
print('wrote', wav)

# ---------------------------------------------------------------- put it on the video (no re-render of the frames)
video, silent = HERE / 'MASAR_promo.mp4', HERE / 'MASAR_promo_silent.mp4'  # render.py writes the silent one
subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(silent), '-i', str(wav), '-map', '0:v', '-map', '1:a',
                '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
                '-shortest', '-movflags', '+faststart', str(video)], check=True)
print('done', video)
