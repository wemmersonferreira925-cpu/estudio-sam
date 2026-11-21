"""Sam Studio v6 — áudio: SFX sintetizados (sem licença de terceiros), mix sob a voz, boca (lip-sync) e master.

Uso:  python3 sam_audio.py narracao.wav episode.json pasta_saida
- lê episode["duracao"], episode["fps"] e episode["sfx"] = [[nome, tempo_s, ganho], ...]
- grava pasta_saida/mix_pre.wav, pasta_saida/mix.wav (−14 LUFS, TP −1.5 dBFS) e pasta_saida/timing.json (boca por quadro)
SFX disponíveis: whoosh, whoosh_leve, zip, bonk, pop, tick, ding, tink, blip, thud, clank, coro, grilos, passo
"""
import json, os, subprocess, sys, wave
import numpy as np

SR = 48000
_rng = np.random.default_rng(7)

def read_audio(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768

def write_wav(path, x):
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

def _t(d): return np.arange(int(d * SR)) / SR
def _env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def _lowpass(x, fc):
    y = np.zeros_like(x); al = 1 - np.exp(-2 * np.pi * fc / SR); s = 0.0
    for k in range(len(x)): s += al * (x[k] - s); y[k] = s
    return y
def _band(d, f0, f1):
    n = _rng.standard_normal(int(d * SR)).astype(np.float32); out = np.zeros_like(n); s1 = s2 = 0.0
    fs = np.linspace(f0, f1, len(n))
    for k in range(len(n)):
        al = 1 - np.exp(-2 * np.pi * fs[k] / SR); s1 += al * (n[k] - s1); s2 += al * (s1 - s2); out[k] = s1 - s2 * 0.6
    return out

def synth_sfx():
    S = {}
    t = _t(0.42); S['whoosh'] = _band(0.42, 300, 3200) * np.sin(np.pi * t / 0.42) ** 2 * 1.6
    t = _t(0.25); S['whoosh_leve'] = _band(0.25, 800, 3000) * np.sin(np.pi * t / 0.25) ** 2 * 0.9
    t = _t(0.22); S['zip'] = _band(0.22, 1500, 6000) * np.sin(np.pi * t / 0.22) * 1.4
    t = _t(0.32); f = 210 * np.exp(-t * 7) + 70
    S['bonk'] = (np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.002, 0.12) + 0.4 * _band(0.32, 2000, 2000) * _env(len(t), 0.001, 0.015)) * 1.1
    t = _t(0.09); f = np.linspace(500, 1100, len(t)); S['pop'] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.09) * 0.9
    t = _t(0.03); S['tick'] = _band(0.03, 3500, 3500) * _env(len(t), 0.0005, 0.006) * 2.2
    t = _t(1.3); S['ding'] = (np.sin(2 * np.pi * 1318 * t) + 0.45 * np.sin(2 * np.pi * 2637 * t) + 0.2 * np.sin(2 * np.pi * 3951 * t)) * _env(len(t), 0.002, 0.35) * 0.55
    t = _t(0.5); S['tink'] = (np.sin(2 * np.pi * 2093 * t) + 0.5 * np.sin(2 * np.pi * 3136 * t)) * _env(len(t), 0.001, 0.12) * 0.5
    t = _t(0.12); S['blip'] = np.sin(2 * np.pi * np.where(t < 0.06, 880, 1320) * t) * np.sin(np.pi * t / 0.12) * 0.45
    t = _t(0.35); S['thud'] = np.sin(2 * np.pi * (95 * np.exp(-t * 4)) * t) * _env(len(t), 0.001, 0.12) * 1.3 + _band(0.35, 600, 300) * _env(len(t), 0.001, 0.05) * 1.5
    t = _t(0.9); S['clank'] = sum(np.sin(2 * np.pi * fq * t) * w for fq, w in [(523, 1), (1187, .6), (1879, .45), (2711, .3)]) * _env(len(t), 0.001, 0.22) * 0.45
    t = _t(1.8); ch = sum(np.sin(2 * np.pi * fq * t * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t))) for fq in [261.6, 329.6, 392.0, 523.3, 659.3])
    S['coro'] = _lowpass(ch * np.sin(np.pi * t / 1.8) ** 1.5, 1800) * 0.33
    t = _t(0.9); cr = np.zeros_like(t)
    for s0 in [0.0, 0.32, 0.64]:
        m = (t >= s0) & (t < s0 + 0.16); cr[m] = np.sin(2 * np.pi * 4300 * t[m]) * (np.sin(2 * np.pi * 30 * t[m]) > 0) * np.sin(np.pi * (t[m] - s0) / 0.16)
    S['grilos'] = cr * 0.22
    t = _t(0.16); S['passo'] = _band(0.16, 500, 200) * _env(len(t), 0.003, 0.04) * 1.2
    return {k: v.astype(np.float32) for k, v in S.items()}

def mix(voice, sfx_list, total):
    N = int(total * SR); out = np.zeros(N, np.float32); out[:min(N, len(voice))] = voice[:N]
    S = synth_sfx()
    for name, at, g in sfx_list:
        if name not in S: raise SystemExit(f'SFX desconhecido: {name}. Disponíveis: {", ".join(S)}')
        i0 = int(at * SR)
        if 0 <= i0 < N: seg = S[name][:N - i0]; out[i0:i0 + len(seg)] += seg * g * 0.42
    return np.clip(out, -1, 1)

def boca(voice, fps, total):
    hop = SR // fps; n = int(total * fps)
    v = np.zeros(n * hop, np.float32); v[:min(len(voice), n * hop)] = voice[:n * hop]
    rms = np.sqrt((v.reshape(n, hop) ** 2).mean(axis=1) + 1e-12); db = 20 * np.log10(rms + 1e-9)
    voiced = db[db > -40]; hi = np.percentile(voiced, 90) if voiced.size else -10; lo = -42.0
    env = np.clip((db - lo) / (hi - lo), 0, 1) ** 1.3
    out, a = [], 0.0
    for x in env: a = x if x > a else a * 0.55 + x * 0.45; out.append(round(float(a), 3))
    return out

def master(inp, out):
    tmp = out[:-4] + '_lim.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', inp, '-af', 'alimiter=limit=0.6:attack=4:release=60:level=disabled', '-ar', str(SR), tmp], check=True)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', tmp, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    j = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample={SR}")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', af, '-ar', str(SR), out], check=True)
    os.remove(tmp)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    lines = [l.strip() for l in r.stderr.splitlines() if l.strip().startswith(('I:', 'Peak:'))]
    return lines[-2:]

if __name__ == '__main__':
    narr, epf, outdir = sys.argv[1:4]
    os.makedirs(outdir, exist_ok=True)
    ep = json.load(open(epf, encoding='utf-8'))
    voice = read_audio(narr)
    write_wav(os.path.join(outdir, 'mix_pre.wav'), mix(voice, ep.get('sfx', []), ep['duracao']))
    print('master:', master(os.path.join(outdir, 'mix_pre.wav'), os.path.join(outdir, 'mix.wav')))
    json.dump({'boca': boca(voice, ep.get('fps', 30), ep['duracao'])}, open(os.path.join(outdir, 'timing.json'), 'w'))
    print('ok ->', outdir)
