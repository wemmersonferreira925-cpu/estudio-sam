/* Sam Studio v7 — áudio: efeitos sonoros gerados por código (sempre iguais, sem arquivos), mixagem da narração +
   trilha (com "abaixa a música quando o Sam fala") + efeitos, loudness −14 LUFS para YouTube/TikTok, WAV e boca. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const rnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // ruído filtrado (passa-banda com frequência variável)
  function bandNoise(n, sr, fAt, q, seed) {
    const out = new Float32Array(n), r = rnd(seed); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) { const w0 = TAU * Math.min(fAt(i / sr), sr * 0.45) / sr, al = Math.sin(w0) / (2 * q), a0 = 1 + al, a1 = -2 * Math.cos(w0), a2 = 1 - al;
      const x = r() * 2 - 1, y = (al * x - al * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y; }
    return out;
  }
  const buf = (d, sr) => new Float32Array(Math.ceil(d * sr));
  function tone(o, sr, t0, d, fAt, ampAt, wave = 'sin') {
    let ph = 0; const i0 = Math.floor(t0 * sr), n = Math.floor(d * sr);
    for (let i = 0; i < n && i0 + i < o.length; i++) { const t = i / sr; ph += TAU * fAt(t) / sr;
      const v = wave === 'sq' ? Math.sin(ph) + Math.sin(3 * ph) / 3 + Math.sin(5 * ph) / 5 : Math.sin(ph); o[i0 + i] += v * ampAt(t); }
  }
  const fade = (t, d, a = 0.004, r = 0.01) => Math.min(1, t / a, Math.max(0, (d - t) / r));
  const SYN = {
    whoosh(sr, d = 0.55, amp = 1) { const o = bandNoise(Math.floor(d * sr), sr, t => 300 + 2600 * Math.pow(t / d, 1.4), 1.2, 1);
      for (let i = 0; i < o.length; i++) { const k = i / o.length; o[i] *= 2.4 * amp * Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.15)), 2); } return o; },
    whoosh_leve(sr) { const d = 0.36, o = bandNoise(Math.floor(d * sr), sr, t => 500 + 1500 * (t / d), 1.0, 2);
      for (let i = 0; i < o.length; i++) { const k = i / o.length; o[i] *= 1.3 * Math.pow(Math.sin(Math.PI * k), 2); } return o; },
    pop(sr) { const d = 0.13, o = buf(d, sr); tone(o, sr, 0, d, t => 300 + 650 * Math.exp(-t / 0.025), t => 0.9 * Math.exp(-t / 0.035) * fade(t, d, 0.002, 0.02)); return o; },
    ding(sr) { const d = 1.3, o = buf(d, sr); [[1318.5, 1, 0.5], [2637, 0.45, 0.3], [3955.5, 0.2, 0.2], [5274, 0.1, 0.14]].forEach(([f, a, tau]) => tone(o, sr, 0, d, () => f, t => 0.42 * a * Math.exp(-t / tau) * fade(t, d, 0.003, 0.05))); return o; },
    plim(sr) { const d = 0.7, o = buf(d, sr); tone(o, sr, 0, d, () => 2093, t => 0.35 * Math.exp(-t / 0.18) * fade(t, d)); tone(o, sr, 0, d, () => 4186, t => 0.1 * Math.exp(-t / 0.1) * fade(t, d)); return o; },
    carimbo(sr) { const d = 0.45, o = buf(d, sr); tone(o, sr, 0, d, t => 70 + 40 * Math.exp(-t / 0.03), t => 1.0 * Math.exp(-t / 0.12) * fade(t, d, 0.001, 0.05));
      tone(o, sr, 0, d, () => 150, t => 0.4 * Math.exp(-t / 0.05) * fade(t, d)); const nz = bandNoise(Math.floor(0.06 * sr), sr, () => 900, 0.7, 3);
      for (let i = 0; i < nz.length; i++) o[i] += nz[i] * 1.6 * Math.exp(-i / sr / 0.015); return o; },
    alerta(sr) { const d = 0.34, o = buf(d, sr); tone(o, sr, 0, 0.12, () => 880, t => 0.32 * fade(t, 0.12, 0.004, 0.012), 'sq'); tone(o, sr, 0.16, 0.14, () => 660, t => 0.32 * fade(t, 0.14, 0.004, 0.02), 'sq'); return o; },
    tick(sr) { const d = 0.05, o = buf(d, sr); tone(o, sr, 0, d, () => 2400, t => 0.5 * Math.exp(-t / 0.008)); return o; },
    boing(sr) { const d = 0.65, o = buf(d, sr); tone(o, sr, 0, d, t => 200 + 380 * (1 - Math.exp(-t / 0.07)) + 45 * Math.sin(TAU * 17 * t) * Math.exp(-t / 0.3), t => 0.5 * Math.exp(-t / 0.25) * fade(t, d, 0.003, 0.08)); return o; },
    coracao(sr) { const d = 0.55, o = buf(d, sr); tone(o, sr, 0, 0.14, t => 62 - 15 * t, t => 1.0 * Math.exp(-t / 0.06) * fade(t, 0.14, 0.003, 0.03)); tone(o, sr, 0.24, 0.12, t => 78 - 18 * t, t => 0.7 * Math.exp(-t / 0.05) * fade(t, 0.12, 0.003, 0.03)); return o; },
    scratch(sr) { const d = 0.4, o = bandNoise(Math.floor(d * sr), sr, t => 2200 - 1700 * Math.sin(Math.PI * Math.min(1, t / 0.18)) + 900 * Math.max(0, (t - 0.18) / 0.22), 3, 4);
      for (let i = 0; i < o.length; i++) { const t = i / sr; o[i] *= 2.0 * fade(t, d, 0.003, 0.06) * (0.6 + 0.4 * Math.sin(TAU * 30 * t)); } return o; },
    erro(sr) { const d = 0.36, o = buf(d, sr); tone(o, sr, 0, 0.13, () => 160, t => 0.35 * fade(t, 0.13, 0.004, 0.02), 'sq'); tone(o, sr, 0.19, 0.15, () => 150, t => 0.35 * fade(t, 0.15, 0.004, 0.03), 'sq'); return o; },
    sucesso(sr) { const d = 0.95, o = buf(d, sr); [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => tone(o, sr, k * 0.085, d - k * 0.085, () => f, t => 0.26 * Math.exp(-t / 0.22) * fade(t, d - k * 0.085, 0.003, 0.05))); return o; },
    riser(sr) { const d = 1.3, o = bandNoise(Math.floor(d * sr), sr, t => 300 + 3200 * Math.pow(t / d, 2), 1.4, 5);
      for (let i = 0; i < o.length; i++) { const k = i / o.length; o[i] *= 1.6 * Math.pow(k, 2) * fade(i / sr, d, 0.01, 0.03); } tone(o, sr, 0, d, t => 180 + 900 * Math.pow(t / d, 2), t => 0.18 * Math.pow(t / d, 2) * fade(t, d, 0.01, 0.03)); return o; },
    impacto(sr) { const d = 1.1, o = buf(d, sr); tone(o, sr, 0, d, t => 48 + 30 * Math.exp(-t / 0.05), t => 1.0 * Math.exp(-t / 0.35) * fade(t, d, 0.001, 0.1));
      const nz = bandNoise(Math.floor(0.25 * sr), sr, t => 400 - 300 * t, 0.6, 6); for (let i = 0; i < nz.length; i++) o[i] += nz[i] * 1.4 * Math.exp(-i / sr / 0.06); return o; },
  };
  const cache = {};
  function synth(name, sr) { const k = name + '@' + sr; if (!cache[k]) cache[k] = (SYN[name] || SYN.pop)(sr); return cache[k]; }

  function envelope(ch, sr, hz = 100) { const hop = Math.round(sr / hz), n = Math.floor(ch.length / hop), e = new Float32Array(n);
    for (let k = 0; k < n; k++) { let s = 0; for (let i = k * hop; i < (k + 1) * hop; i++) s += ch[i] * ch[i]; e[k] = Math.sqrt(s / hop); } return e; }

  // loudness integrado (ITU-R BS.1770, filtros K para 48 kHz)
  function lufs(chs, sr) {
    const kf = x => { const o = new Float32Array(x.length); let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
      for (let i = 0; i < x.length; i++) { const v = x[i]; const y = 1.53512485958697 * v - 2.69169618940638 * a1 + 1.19839281085285 * a2 + 1.69065929318241 * b1 - 0.73248077421585 * b2; a2 = a1; a1 = v; b2 = b1; b1 = y;
        const z = y - 2 * c1 + c2 + 1.99004745483398 * d1 - 0.99007225036621 * d2; c2 = c1; c1 = y; d2 = d1; d1 = z; o[i] = z; } return o; };
    const f = chs.map(kf), blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), ms = [];
    for (let s = 0; s + blk <= f[0].length; s += hop) { let sum = 0; for (const c of f) { let q = 0; for (let i = s; i < s + blk; i++) q += c[i] * c[i]; sum += q / blk; } ms.push(sum); }
    const L = m => -0.691 + 10 * Math.log10(m + 1e-12), g1 = ms.filter(m => L(m) > -70); if (!g1.length) return -70;
    const rel = L(g1.reduce((a, b) => a + b, 0) / g1.length) - 10, g2 = g1.filter(m => L(m) > rel); return L(g2.reduce((a, b) => a + b, 0) / g2.length);
  }
  // limitador com antecipação (pico de amostra ≤ teto)
  function limit(chs, sr, ceilDb = -1.5) {
    const ceil = Math.pow(10, ceilDb / 20), la = Math.round(0.003 * sr), rel = Math.exp(-1 / (0.08 * sr)), n = chs[0].length, g = new Float32Array(n);
    const need = new Float32Array(n); for (let i = 0; i < n; i++) { let p = 0; for (const c of chs) p = Math.max(p, Math.abs(c[i])); need[i] = p > ceil ? ceil / p : 1; }
    let cur = 1; for (let i = n - 1; i >= 0; i--) { let m = 1; for (let j = i; j < Math.min(n, i + la); j++) m = Math.min(m, need[j]); cur = m < cur ? m : cur + (1 - cur) * (1 - rel); g[i] = Math.min(m, cur); }
    let sm = 1; for (let i = 0; i < n; i++) { sm = g[i] < sm ? g[i] : sm + (g[i] - sm) * (1 - rel); for (const c of chs) c[i] *= Math.min(sm, g[i]); }
  }
  // mixa tudo e entrega um AudioBuffer estéreo 48 kHz em −14 LUFS
  async function mix(o) {
    const sr = 48000, n = Math.ceil((o.dur || 1) * sr), oc = new OfflineAudioContext(2, n, sr);
    if (o.voz) { const s = oc.createBufferSource(); s.buffer = o.voz; const g = oc.createGain(); g.gain.value = o.vozVol ?? 1; s.connect(g); g.connect(oc.destination); s.start(o.vozInicio || 0); }
    if (o.musica) {
      const s = oc.createBufferSource(); s.buffer = o.musica; s.loop = true; const g = oc.createGain(), base = o.musicaVol ?? 0.12; g.gain.setValueAtTime(base, 0);
      if (o.voz) { const e = envelope(o.voz.getChannelData(0), o.voz.sampleRate, 20), thr = Math.max(...e) * 0.08; let on = false;
        for (let i = 0; i < e.length; i++) { const now = e[i] > thr; if (now !== on) { g.gain.setTargetAtTime(now ? base * 0.4 : base, (o.vozInicio || 0) + i / 20, 0.12); on = now; } } }
      g.gain.setTargetAtTime(0, Math.max(0, o.dur - 1.4), 0.35); s.connect(g); g.connect(oc.destination); s.start(0);
    }
    for (const [name, t, vol] of o.sfx || []) { if (!(t >= 0 && t < o.dur)) continue; const d = synth(name, sr), b = oc.createBuffer(1, d.length, sr); b.copyToChannel(d, 0);
      const s = oc.createBufferSource(); s.buffer = b; const g = oc.createGain(); g.gain.value = (vol ?? 0.6) * (o.sfxVol ?? 0.5); s.connect(g); g.connect(oc.destination); s.start(t); }
    const out = await oc.startRendering(), chs = [out.getChannelData(0), out.getChannelData(1)];
    const now = lufs(chs, sr); if (now > -60) { const k = Math.pow(10, ((o.alvoLufs ?? -14) - now) / 20); for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= k; }
    limit(chs, sr, -1.5);
    out.lufs = lufs(chs, sr); return out;
  }
  function toWav(ab) {
    const nc = ab.numberOfChannels, n = ab.length, sr = ab.sampleRate, b = new ArrayBuffer(44 + n * nc * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * nc * 2, true);
    const chs = []; for (let c = 0; c < nc; c++) chs.push(ab.getChannelData(c)); let p = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const x = Math.max(-1, Math.min(1, chs[c][i])); v.setInt16(p, x < 0 ? x * 0x8000 : x * 0x7fff, true); p += 2; }
    return new Blob([b], { type: 'audio/wav' });
  }
  // boca do Sam a partir da voz (igual ao v6)
  function boca(ab, fps, dur, inicio = 0) {
    const ch = ab.getChannelData(0), sr = ab.sampleRate, hop = Math.round(sr / fps), n = Math.ceil(dur * fps), off = Math.round(inicio * fps), db = new Float32Array(n).fill(-90);
    for (let k = 0; k < n; k++) { const kk = k - off; if (kk < 0) continue; let s = 0, c = 0; for (let i = kk * hop; i < Math.min((kk + 1) * hop, ch.length); i++) { s += ch[i] * ch[i]; c++; } db[k] = 20 * Math.log10((c ? Math.sqrt(s / c) : 0) + 1e-9); }
    const voiced = Array.from(db).filter(x => x > -40).sort((a, b) => a - b), hi = voiced.length ? voiced[Math.floor(voiced.length * 0.9)] : -10, lo = -42;
    const out = new Array(n); let a = 0; for (let k = 0; k < n; k++) { let v = Math.min(1, Math.max(0, (db[k] - lo) / (hi - lo))); v = Math.pow(v, 1.3); a = v > a ? v : a * 0.55 + v * 0.45; out[k] = a; }
    return out;
  }
  global.SamAudio = { SFX: Object.keys(SYN), synth, mix, lufs, toWav, boca, envelope };
})(typeof window !== 'undefined' ? window : globalThis);
