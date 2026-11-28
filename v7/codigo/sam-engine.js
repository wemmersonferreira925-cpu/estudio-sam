/* ============================================================
   SAM STUDIO v6 — motor de animação ("Sam vivo")
   Canvas 2D, determinístico: renderAt(t) desenha o quadro do tempo t.
   O mesmo motor roda no navegador (studio) e no render headless.
   ============================================================ */
(function (global) {
'use strict';
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => (b === a ? (x >= b ? 1 : 0) : clamp((x - a) / (b - a), 0, 1));
const Ease = {
  linear: t => t,
  inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vis = (t, t0, t1, fi = .25, fo = .25) => {
  if (t < t0 || t > t1) return 0;
  return Math.min(fi > 0 ? inv(t0, t0 + fi, t) : 1, fo > 0 ? 1 - inv(t1 - fo, t1, t) : 1);
};
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const FONT_SUB = '"DejaVu Sans", Verdana, "Segoe UI", Arial, sans-serif';
const FONT_DISPLAY = '"Archivo Black", "Arial Black", Impact, sans-serif';
const FONT_STAMP = 'Anton, Impact, "Arial Black", sans-serif';
const YELLOW = '#FFD21F', INK = '#111111';
/* 9:16 (TikTok, Reels, Shorts): a interface do app cobre o topo (abas), a base (legenda do post, @, som) e a
   coluna de botões à direita. Tudo que é texto ou gag fica dentro desta caixa. */
const SAFE_V = { x0: 72, x1: 948, y0: 262, y1: 1400, topo: 262 };
const OCC = []; // 9:16: caixas já ocupadas no quadro atual (data, nome, mapa, gancho e gags já colocados)
function fitV(L, p, hw, hh, hb) { // empurra o centro p para a caixa (meia-largura hw, meia-altura hh/hb) caber na zona segura
  if (!L.v) return p; const b = SAFE_V, bot = hb === undefined ? hh : hb;
  const f = (lo, hi, v) => (lo > hi ? (lo + hi) / 2 : clamp(v, lo, hi));
  return [f(b.x0 + hw, b.x1 - hw, p[0]), f(b.y0 + hh, b.y1 - bot, p[1])];
}
function placeV(L, p, hw, hh, hb) { // como fitV, e ainda desvia das caixas já ocupadas (desce; se não couber, sobe)
  if (!L.v) return p; const bot = hb === undefined ? hh : hb;
  let q = fitV(L, p, hw, hh, bot);
  const hit = c => OCC.find(b => c[0] - hw < b[2] && c[0] + hw > b[0] && c[1] - hh < b[3] && c[1] + bot > b[1]);
  for (let n = 0; n < 6; n++) {
    const b = hit(q); if (!b) break;
    const down = [q[0], b[3] + hh + 12], up = [q[0], b[1] - bot - 12];
    if (down[1] + bot <= SAFE_V.y1) q = down; else if (up[1] - hh >= SAFE_V.topo) q = up; else break;
  }
  OCC.push([q[0] - hw, q[1] - hh, q[0] + hw, q[1] + bot]);
  return q;
}
const CENTRO_V = new Set(['alerta', 'cuidado', 'fato', 'numero', 'lista', 'carimbo', 'cartao', 'placa']);
function posV(L, ev, def) { // posição do overlay: "pos" no 16:9; "pv" no 9:16 (sem pv, converte a do 16:9)
  if (L.v && !ev.pv && CENTRO_V.has(ev.tipo)) return [540, 600];
  const p = ev.pos || def || [960, 400]; if (!L.v) return p; if (ev.pv) return ev.pv;
  return [p[0] / 1920 * L.W, SAFE_V.y0 + p[1] / 1080 * (SAFE_V.y1 - SAFE_V.y0)];
}

/* ---------------- RIG DO SAM (unidades a escala 1 ≈ 470 px de altura) ---------------- */
const RIG = { headR: 80, neckW: 30, neckH: 18, torsoTop: -292, torsoBot: -142, torsoTopW: 112, torsoBotW: 126,
  hipX: 24, hipY: -150, legLen: 138, shoulderX: 50, shoulderY: -276, upper: 64, fore: 58, handR: 15,
  footRx: 26, footRy: 12, limbW: 12, ol: 6 };
const HEAD_CY = RIG.torsoTop - RIG.neckH - RIG.headR * 0.86;
const VIEW = { x0: 0, x1: 1920 };

/* Poses: ângulos dos braços [ombro, cotovelo] em graus a partir de "para baixo", positivo = para fora.
   R = braço do lado direito da tela, L = lado esquerdo. Catálogo validado (nomes fixos). */
const POSES = {
  idle:            { R: [8, 6],     L: [8, 6] },
  neutro:          { R: [8, 6],     L: [8, 6] },
  apontar:         { R: [100, -8],  L: [8, 6], cab: -3, dedo: 'R' },
  apontar_lado:    { R: [100, -8],  L: [8, 6], cab: -3, dedo: 'R' },
  apontar_esq:     { R: [8, 6],     L: [100, -8], cab: 3, dedo: 'L' },
  apontar_cima:    { R: [160, 0],   L: [10, 6], dedo: 'R' },
  dar_de_ombros:   { R: [32, 78],   L: [32, 78], cab: -5, ombros: -10 },
  maos_ao_alto:    { R: [148, 18],  L: [148, 18] },
  susto:           { R: [148, 18],  L: [148, 18] },
  comemorar:       { R: [162, 10],  L: [162, 10] },
  rezar:           { R: [2, -112],  L: [2, -112] },
  reverencia:      { R: [2, -112],  L: [2, -112], cab: 4 },
  segurar_mapa:    { R: [25, -75],  L: [25, -75] },
  maos_na_cintura: { R: [35, -66],  L: [35, -66] },
  reivindicar:     { R: [135, 25],  L: [35, -66], dedo: 'R' },
  acenar:          { R: [150, -15], L: [8, 6], onda: 'R' },
  segurar_lanca:   { R: [20, -40],  L: [8, 6] },
  erguer:          { R: [160, 6],   L: [10, 6] },
  segurar:         { R: [25, -75],  L: [25, -75] },
  assinar:         { R: [18, -100], L: [10, 6], cab: 4 },
  sarcasmo:        { R: [100, -8],  L: [35, -66], cab: 4, dedo: 'R' },
  sarcasmo_esq:    { R: [35, -66],  L: [100, -8], cab: -4, dedo: 'L' },
  bracos_cruzados: { R: [22, -112], L: [18, -104], cab: 2 },
  explicar:        { R: [45, 30],   L: [8, 6] },
  explicar_esq:    { R: [8, 6],     L: [45, 30] },
};
const POSE_NAMES = Object.keys(POSES);
function blendPose(a, b, k) {
  const o = { R: [lerp(a.R[0], b.R[0], k), lerp(a.R[1], b.R[1], k)], L: [lerp(a.L[0], b.L[0], k), lerp(a.L[1], b.L[1], k)],
    cab: lerp(a.cab || 0, b.cab || 0, k), ombros: lerp(a.ombros || 0, b.ombros || 0, k) };
  o.dedo = k > 0.5 ? b.dedo : a.dedo; o.onda = k > 0.5 ? b.onda : a.onda;
  return o;
}

/* Expressões (catálogo validado). deadpan = cara padrão do Sam. */
const EXPR = {
  deadpan:        { brows: 'flat', eyes: 'lid', mouth: 'line' },
  serio:          { brows: 'flat', eyes: 'lid', mouth: 'line' },
  neutro:         { brows: 'flat', eyes: 'lid', mouth: 'line' },
  falando:        { brows: 'flat', eyes: 'lid', mouth: 'line' },
  cetico:         { brows: 'one_up', eyes: 'lid', mouth: 'line' },
  sorriso:        { brows: 'flat', eyes: 'lid', mouth: 'smirk' },
  orgulhoso:      { brows: 'up_small', eyes: 'lid', mouth: 'smirk' },
  surpreso:       { brows: 'up', eyes: 'wide', mouth: 'o' },
  assustado:      { brows: 'worried', eyes: 'wide', mouth: 'o', sweat: true },
  feliz:          { brows: 'up_small', eyes: 'happy', mouth: 'smile' },
  olhos_fechados: { brows: 'flat', eyes: 'closed', mouth: 'line' },
  irritado:       { brows: 'angry', eyes: 'lid', mouth: 'line' },
  sarcastico:     { brows: 'one_up', eyes: 'lid', mouth: 'smirk' },
  revirando:      { brows: 'flat', eyes: 'lid', mouth: 'line' },
  julgando:       { brows: 'angry', eyes: 'lid', mouth: 'smirk' },
  preocupado:     { brows: 'worried', eyes: 'lid', mouth: 'line' },
};
const EXPR_NAMES = Object.keys(EXPR);

/* Figurinos */
function torsoPath(ctx, lift) {
  const t = RIG.torsoTop + lift, b = RIG.torsoBot, tw = RIG.torsoTopW / 2, bw = RIG.torsoBotW / 2, r = 20;
  ctx.beginPath();
  ctx.moveTo(-tw + r, t); ctx.lineTo(tw - r, t); ctx.quadraticCurveTo(tw, t, tw + 2, t + r);
  ctx.lineTo(bw, b - r); ctx.quadraticCurveTo(bw, b, bw - r, b); ctx.lineTo(-bw + r, b);
  ctx.quadraticCurveTo(-bw, b, -bw, b - r); ctx.lineTo(-tw - 2, t + r); ctx.quadraticCurveTo(-tw, t, -tw + r, t);
  ctx.closePath();
}
const COSTUMES = {
  eua: {
    armStyle: 'white', boot: '#151515', leg: '#151515',
    torso(ctx, lift) {
      const t = RIG.torsoTop + lift, b = RIG.torsoBot;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-90, t - 5, 180, b - t + 10);
      const n = 7, h = (b - t) / n;
      ctx.fillStyle = '#d42b2b';
      for (let i = 0; i < n; i += 2) ctx.fillRect(-90, t + i * h, 180, h);
      ctx.fillStyle = '#23409a'; ctx.fillRect(-90, t - 5, 92, h * 3.6);
      ctx.fillStyle = '#fff';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        star(ctx, -70 + c * 20, t + 12 + r * 20, 6.5); }
    },
  },
  capitao: {
    armStyle: 'black', boot: '#2a1a0e', leg: '#151515', sleeve: '#7f5229',
    torso(ctx, lift) {
      const t = RIG.torsoTop + lift, b = RIG.torsoBot;
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-90, t - 5, 180, b - t + 10);
      ctx.fillStyle = 'rgba(60,30,10,0.28)'; ctx.fillRect(28, t - 5, 70, b - t + 10);
      ctx.fillStyle = '#d8b98e';
      ctx.beginPath(); ctx.moveTo(-34, t - 2); ctx.lineTo(34, t - 2); ctx.lineTo(0, t + 46); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#3a2312'; ctx.fillRect(-80, b - 40, 160, 17);
      ctx.fillStyle = '#e1b04b'; rr(ctx, -12, b - 43, 24, 23, 4); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#e1b04b';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, t + 62 + i * 20, 5, 0, TAU); ctx.fill(); }
    },
    hat(ctx, R) {
      ctx.save(); ctx.translate(-0.04 * R, -0.74 * R); ctx.rotate(-7 * D2R);
      ctx.lineWidth = RIG.ol; ctx.strokeStyle = INK;
      ctx.fillStyle = '#5c3819'; ctx.beginPath(); ctx.ellipse(0, 0.06 * R, 1.08 * R, 0.21 * R, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7b4c25'; ctx.beginPath(); ctx.ellipse(0, -0.02 * R, 0.8 * R, 0.56 * R, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a2312'; ctx.beginPath(); ctx.rect(-0.79 * R, -0.14 * R, 1.58 * R, 0.12 * R); ctx.fill();
      ctx.restore();
    },
  },
  padrao: {
    armStyle: 'black', boot: '#151515', leg: '#151515',
    torso(ctx, lift) { ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-90, RIG.torsoTop + lift - 5, 180, 170); },
  },
};
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  ctx.closePath(); ctx.fill();
}

/* ---------------- BIBLIOTECA DE FIGURINOS v6.1 (personagens do Brasil e além) ----------------
   Cada figurino pode ter: back (capa atrás do corpo), lower (saia/vestido/short sobre as pernas),
   torso (recortado no tronco), front (gola, colar, faixa), hatBack (penas atrás da cabeça),
   face (barba/bigode), hat (chapéu/coroa), sleeve (cor da manga), boot (cor do calçado). */
function shape(ctx, pts, fill, lw = 4) {
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function ell(ctx, x, y, rx, ry, fill, lw = 4, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
function dots(ctx, xs, y0, n, dy, color = '#e1b04b', r = 5) { ctx.fillStyle = color; for (const x of xs) for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x, y0 + i * dy, r, 0, TAU); ctx.fill(); } }
function ermine(ctx, pts, w) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
  path(); ctx.strokeStyle = INK; ctx.lineWidth = w + 8; ctx.stroke(); path(); ctx.strokeStyle = '#fbfbf4'; ctx.lineWidth = w; ctx.stroke();
  ctx.fillStyle = INK;
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 9; d < L; d += 24) { const k = d / L; ctx.beginPath(); ctx.ellipse(lerp(x0, x1, k), lerp(y0, y1, k), 2.4, 4.2, 0, 0, TAU); ctx.fill(); } }
  ctx.restore();
}
function necklace(ctx, tT, colors, dip = 34, w = 44, r = 5.5) {
  for (let i = 0; i <= 12; i++) { const k = i / 12, x = lerp(-w, w, k), y = tT + 8 + Math.sin(Math.PI * k) * dip;
    ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
}
function capeBack(ctx, lift, color, trim) {
  const t = RIG.torsoTop + lift;
  ctx.beginPath(); ctx.moveTo(-56, t + 8); ctx.lineTo(56, t + 8); ctx.quadraticCurveTo(110, -120, 132, -22);
  ctx.quadraticCurveTo(66, 4, 0, 4); ctx.quadraticCurveTo(-66, 4, -132, -22); ctx.quadraticCurveTo(-110, -120, -56, t + 8); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  if (trim === 'arminho') ermine(ctx, [[-128, -24], [-66, 0], [0, 2], [66, 0], [128, -24]], 15);
  if (trim === 'penas') { ctx.fillStyle = '#f2c230'; for (let i = -5; i <= 5; i++) { const x = i * 22, y = -8 - Math.abs(i) * 2; ctx.beginPath(); ctx.ellipse(x, y, 10, 15, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); } }
}
function crownShape(ctx, R, y, w, h, gold = '#f2c230') {
  ctx.save(); ctx.translate(0, y);
  shape(ctx, [[-w / 2, 0], [-w / 2, -h * 0.9], [-w * 0.33, -h * 0.42], [-w * 0.17, -h], [0, -h * 0.42], [w * 0.17, -h], [w * 0.33, -h * 0.42], [w / 2, -h * 0.9], [w / 2, 0]], gold, 5);
  ctx.fillStyle = '#d39a1c'; ctx.fillRect(-w / 2 + 3, -h * 0.24, w - 6, h * 0.2);
  [[-w * 0.3, '#d6303a'], [0, '#2f6fd6'], [w * 0.3, '#2f9e5a']].forEach(([x, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, -h * 0.14, h * 0.09, 0, TAU); ctx.fill(); });
  for (const x of [-w / 2, -w * 0.17, w * 0.17, w / 2]) ell(ctx, x, x === -w / 2 || x === w / 2 ? -h * 0.92 : -h * 1.02, h * 0.08, h * 0.08, gold, 3);
  ctx.restore();
}
function featherFan(ctx, R, n, spread, len, dist, colors, cy) {
  for (let i = 0; i < n; i++) { const a = (-spread / 2 + spread * i / (n - 1)) * D2R;
    const x = Math.sin(a) * dist, y = cy - Math.cos(a) * dist;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ell(ctx, 0, 0, len * 0.22, len, colors[i % colors.length], 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, len * 0.9); ctx.lineTo(0, -len * 0.8); ctx.stroke(); ctx.restore(); }
}
const T0 = lift => RIG.torsoTop + lift;
Object.assign(COSTUMES, {
  tupi: { armStyle: 'black', boot: '#151515', sleeve: null,
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#fbfbfb'; ctx.fillRect(-90, t - 5, 180, 170);
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i <= 8; i++) ctx.lineTo(-80 + i * 20, t + 58 + (i % 2 ? 12 : 0)); ctx.stroke();
      dots(ctx, [-50, -25, 0, 25, 50], t + 92, 1, 0, '#222', 5);
      ctx.beginPath(); for (let i = 0; i <= 8; i++) ctx.lineTo(-80 + i * 20, t + 118 + (i % 2 ? 10 : 0)); ctx.stroke(); },
    lower(ctx) { ctx.fillStyle = '#c9a15a'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-62, -160);
      for (let i = 0; i <= 10; i++) ctx.lineTo(-62 + i * 12.4, -100 - (i % 2) * 10); ctx.lineTo(62, -160); ctx.closePath(); ctx.fill(); ctx.stroke(); },
    front(ctx, lift) { necklace(ctx, T0(lift), ['#c0392b', '#fbfbf4', '#222']); },
    hatBack(ctx, R) { featherFan(ctx, R, 9, 110, 0.42 * R, 1.08 * R, ['#e53935', '#fbc02d', '#43a047', '#1e88e5', '#fbc02d', '#e53935', '#43a047', '#1e88e5', '#e53935'], -0.42 * R); },
    hat(ctx, R) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.56 * R, 0.97 * R, 0.17 * R, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.lineWidth = 0.17 * R; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 0.12 * R; ctx.strokeStyle = '#c0392b'; ctx.stroke(); ctx.restore(); },
  },
  colono: { armStyle: 'black', boot: '#3a2312', sleeve: '#efe8d6',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#efe8d6'; ctx.fillRect(-90, t - 5, 180, 170);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-90, t - 5, 70, 170); ctx.fillRect(20, t - 5, 70, 170);
      ctx.fillStyle = '#c9a15a'; ctx.fillRect(-90, -182, 180, 12); },
    hat(ctx, R) { ell(ctx, 0, -0.62 * R, 1.32 * R, 0.25 * R, '#e2c36a', 5); ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.64 * R, 0.72 * R, 0.52 * R, 0, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = '#ead07e'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-0.71 * R, -0.8 * R, 1.42 * R, 0.13 * R); ctx.restore(); },
  },
  frances: { armStyle: 'black', boot: '#151515', sleeve: '#1f3a68',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#fbfbfb'; ctx.fillRect(-90, t - 5, 180, 170); ctx.fillStyle = '#1f3a68'; for (let y = t + 8; y < -140; y += 24) ctx.fillRect(-90, y, 180, 11); },
    front(ctx, lift) { const t = T0(lift); shape(ctx, [[-26, t + 2], [26, t + 2], [0, t + 34]], '#d62828', 3); },
    hat(ctx, R) { ell(ctx, 0.1 * R, -0.82 * R, 0.95 * R, 0.3 * R, '#1f3a68', 5, -8 * D2R); ell(ctx, 0.14 * R, -1.1 * R, 0.13 * R, 0.13 * R, '#d62828', 3); },
  },
  nobre: { armStyle: 'black', boot: '#151515', sleeve: '#2a2a2a',
    back(ctx, lift) { capeBack(ctx, lift, '#1b1b1b'); },
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#262626'; ctx.fillRect(-90, t - 5, 180, 170); dots(ctx, [0], t + 44, 4, 22, '#e1b04b', 5); },
    front(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#fbfbf4'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(i * 13, t + 4, 9, 12, 0, 0, TAU); ctx.fill(); ctx.stroke(); } },
    hat(ctx, R) { ell(ctx, 0, -0.66 * R, 1.05 * R, 0.2 * R, '#151515', 5);
      shape(ctx, [[-0.6 * R, -0.7 * R], [0.6 * R, -0.7 * R], [0.5 * R, -1.1 * R], [-0.5 * R, -1.1 * R]], '#1e1e1e', 5);
      ctx.save(); ctx.beginPath(); ctx.moveTo(0.3 * R, -1.02 * R); ctx.quadraticCurveTo(1.2 * R, -1.35 * R, 1.15 * R, -0.62 * R); ctx.quadraticCurveTo(1.0 * R, -0.95 * R, 0.3 * R, -0.9 * R); ctx.closePath();
      ctx.fillStyle = '#f4f4f4'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); },
  },
  garimpeiro: { armStyle: 'black', boot: '#3a2312', sleeve: '#d8c39a',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#d8c39a'; ctx.fillRect(-90, t - 5, 180, 170);
      ctx.strokeStyle = '#5b3a1d'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-30, t - 5); ctx.lineTo(-26, -140); ctx.moveTo(30, t - 5); ctx.lineTo(26, -140); ctx.stroke();
      ctx.fillStyle = 'rgba(110,70,30,0.35)'; [[-50, t + 60], [44, t + 96], [-12, t + 120]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 9, 6, 0.4, 0, TAU); ctx.fill(); }); },
    hat(ctx, R) { ctx.save(); ctx.translate(0, -0.72 * R); ctx.rotate(5 * D2R); ell(ctx, 0, 0.08 * R, 1.26 * R, 0.22 * R, '#6e4a26', 5);
      ctx.beginPath(); ctx.ellipse(0, 0, 0.76 * R, 0.52 * R, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#8a6236'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); },
  },
  rei: { armStyle: 'black', boot: '#151515', sleeve: '#b3202a',
    back(ctx, lift) { capeBack(ctx, lift, '#a3192a', 'arminho'); },
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#b3202a'; ctx.fillRect(-90, t - 5, 180, 170); dots(ctx, [0], t + 50, 4, 22, '#f2c230', 5); ctx.fillStyle = '#f2c230'; ctx.fillRect(-90, -182, 180, 12); },
    front(ctx, lift) { const t = T0(lift); ermine(ctx, [[-58, t + 4], [-30, t + 26], [0, t + 32], [30, t + 26], [58, t + 4]], 16); },
    hat(ctx, R) { crownShape(ctx, R, -0.7 * R, 1.06 * R, 0.6 * R); },
  },
  imperador: { armStyle: 'black', boot: '#151515', sleeve: '#1f7a3a',
    back(ctx, lift) { capeBack(ctx, lift, '#2e8b47', 'penas'); },
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#1f7a3a'; ctx.fillRect(-90, t - 5, 180, 170); ctx.fillStyle = '#f2c230'; ctx.fillRect(-9, t - 5, 18, 170); },
    front(ctx, lift) { const t = T0(lift); ctx.save(); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-54, t + 10); ctx.lineTo(50, -170); ctx.stroke(); ctx.restore(); ctx.fillStyle = '#f2c230'; star(ctx, 34, t + 60, 13); },
    hat(ctx, R) { crownShape(ctx, R, -0.7 * R, 1.06 * R, 0.6 * R); },
  },
  uniforme_imperial: { armStyle: 'black', boot: '#151515', sleeve: '#1d2b57',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#1d2b57'; ctx.fillRect(-90, t - 5, 180, 170); dots(ctx, [-16, 16], t + 40, 5, 20, '#f2c230', 4.5);
      ctx.save(); ctx.strokeStyle = '#1f9e48'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-56, t + 8); ctx.lineTo(56, -168); ctx.stroke(); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); },
    front(ctx, lift) { const t = T0(lift); for (const sd of [-1, 1]) { ell(ctx, sd * 52, t + 8, 22, 9, '#f2c230', 3); ctx.strokeStyle = '#d39a1c'; ctx.lineWidth = 2.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(sd * 52 + i * 5, t + 14); ctx.lineTo(sd * 52 + i * 5, t + 28); ctx.stroke(); } } },
    hat(ctx, R) { ctx.save(); ctx.beginPath(); ctx.moveTo(-1.0 * R, -0.6 * R); ctx.quadraticCurveTo(0, -1.55 * R, 1.0 * R, -0.6 * R); ctx.quadraticCurveTo(0, -0.86 * R, -1.0 * R, -0.6 * R); ctx.closePath();
      ctx.fillStyle = '#161616'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); ell(ctx, 0.28 * R, -0.98 * R, 0.14 * R, 0.14 * R, '#1f9e48', 3); ell(ctx, 0.28 * R, -0.98 * R, 0.06 * R, 0.06 * R, '#f2c230', 0); },
  },
  militar: { armStyle: 'black', boot: '#151515', sleeve: '#4b5b4a',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#4b5b4a'; ctx.fillRect(-90, t - 5, 180, 170); dots(ctx, [0], t + 36, 5, 20, '#e1b04b', 5);
      ctx.fillStyle = '#b3202a'; ctx.fillRect(-26, t - 5, 16, 18); ctx.fillRect(10, t - 5, 16, 18); ctx.fillStyle = '#161616'; ctx.fillRect(-90, -186, 180, 15); ctx.fillStyle = '#c9ced6'; ctx.fillRect(-11, -189, 22, 21); },
    hat(ctx, R) { shape(ctx, [[-0.56 * R, -0.62 * R], [0.56 * R, -0.62 * R], [0.48 * R, -1.12 * R], [-0.48 * R, -1.12 * R]], '#44533f', 5);
      ctx.fillStyle = '#b3202a'; ctx.fillRect(-0.54 * R, -0.76 * R, 1.08 * R, 0.12 * R); ell(ctx, 0, -0.6 * R, 0.64 * R, 0.12 * R, '#111', 4); ell(ctx, 0, -0.9 * R, 0.08 * R, 0.08 * R, '#e1b04b', 2); },
  },
  pedro_ii: { armStyle: 'black', boot: '#151515', sleeve: '#1d1d1d',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#1d1d1d'; ctx.fillRect(-90, t - 5, 180, 170); shape(ctx, [[-22, t - 4], [22, t - 4], [0, t + 64]], '#fbfbf4', 3);
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, t); ctx.lineTo(-4, t + 92); ctx.moveTo(22, t); ctx.lineTo(4, t + 92); ctx.stroke(); },
    front(ctx, lift) { ctx.fillStyle = '#f2c230'; star(ctx, -34, T0(lift) + 66, 13); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, T0(lift) + 52); ctx.lineTo(-20, T0(lift) + 4); ctx.stroke(); },
    face(ctx, R) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(-0.72 * R, 0.02 * R); ctx.quadraticCurveTo(-0.84 * R, 0.85 * R, -0.24 * R, 1.22 * R); ctx.quadraticCurveTo(0, 1.4 * R, 0.24 * R, 1.22 * R);
      ctx.quadraticCurveTo(0.84 * R, 0.85 * R, 0.72 * R, 0.02 * R); ctx.quadraticCurveTo(0.55 * R, 0.6 * R, 0.24 * R, 0.6 * R); ctx.lineTo(-0.24 * R, 0.6 * R); ctx.quadraticCurveTo(-0.55 * R, 0.6 * R, -0.72 * R, 0.02 * R); ctx.closePath();
      ctx.fillStyle = '#e9e9e9'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.strokeStyle = '#b9b9b9'; ctx.lineWidth = 2.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.16 * R, 0.72 * R); ctx.quadraticCurveTo(i * 0.2 * R, 0.95 * R, i * 0.1 * R, 1.15 * R); ctx.stroke(); }
      ell(ctx, -0.15 * R, 0.29 * R, 0.18 * R, 0.07 * R, '#e9e9e9', 4, -0.2); ell(ctx, 0.15 * R, 0.29 * R, 0.18 * R, 0.07 * R, '#e9e9e9', 4, 0.2); ctx.restore(); },
  },
  princesa: { armStyle: 'black', boot: '#151515', sleeve: '#2f5fae',
    lower(ctx) { ctx.beginPath(); ctx.moveTo(-58, -168); ctx.lineTo(58, -168); ctx.quadraticCurveTo(96, -90, 120, -14); ctx.quadraticCurveTo(0, 6, -120, -14); ctx.quadraticCurveTo(-96, -90, -58, -168); ctx.closePath();
      ctx.fillStyle = '#2f5fae'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-110, -30); ctx.quadraticCurveTo(0, -10, 110, -30); ctx.stroke(); },
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#2f5fae'; ctx.fillRect(-90, t - 5, 180, 170); ctx.fillStyle = '#f2c230'; ctx.fillRect(-90, -176, 180, 10); ctx.fillRect(-6, t + 30, 12, 120); },
    front(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#fbfbf4'; ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.arc(i * 12, t + 4, 9, 0, Math.PI); ctx.fill(); ctx.stroke(); }
      necklace(ctx, t + 8, ['#fbfbf4'], 22, 30, 4.5); },
    hat(ctx, R) { shape(ctx, [[-0.46 * R, -0.8 * R], [-0.3 * R, -0.99 * R], [-0.15 * R, -0.9 * R], [0, -1.12 * R], [0.15 * R, -0.9 * R], [0.3 * R, -0.99 * R], [0.46 * R, -0.8 * R], [0, -0.86 * R]], '#f2c230', 4);
      ell(ctx, 0, -0.98 * R, 0.07 * R, 0.07 * R, '#2f6fd6', 2); },
  },
  presidente: { armStyle: 'black', boot: '#151515', sleeve: '#3b4048',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#3b4048'; ctx.fillRect(-90, t - 5, 180, 170); shape(ctx, [[-24, t - 4], [24, t - 4], [0, t + 74]], '#fbfbf4', 3);
      shape(ctx, [[-7, t + 6], [7, t + 6], [10, t + 60], [0, t + 74], [-10, t + 60]], '#8b1e2b', 2.5);
      ctx.strokeStyle = '#262a30'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, t); ctx.lineTo(-2, t + 96); ctx.moveTo(24, t); ctx.lineTo(2, t + 96); ctx.stroke(); ctx.fillStyle = '#fbfbf4'; ctx.fillRect(-56, t + 46, 18, 8); },
  },
  jogador: { armStyle: 'black', boot: '#111', sleeve: '#1f9e48',
    lower(ctx) { shape(ctx, [[-64, -160], [64, -160], [66, -98], [8, -98], [0, -118], [-8, -98], [-66, -98]], '#1d4fa3', 4); },
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#f6d21a'; ctx.fillRect(-90, t - 5, 180, 170); shape(ctx, [[-26, t - 4], [26, t - 4], [0, t + 30]], '#1f9e48', 3);
      ctx.fillStyle = '#1f9e48'; ctx.font = `46px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('10', 0, t + 88); },
  },
  carnaval: { armStyle: 'black', boot: '#151515', sleeve: '#e91e8c',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#8e24aa'; ctx.fillRect(-90, t - 5, 180, 170);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const x = -78 + c * 26 + (r % 2) * 13, y = t + 12 + r * 26;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = (r + c) % 3 === 0 ? '#f2c230' : (r + c) % 3 === 1 ? '#e91e8c' : '#00bcd4'; ctx.fillRect(-7, -7, 14, 14); ctx.restore(); } },
    front(ctx, lift) { const t = T0(lift); necklace(ctx, t, ['#f2c230', '#00bcd4', '#e91e8c', '#43a047'], 30, 44, 5); necklace(ctx, t + 14, ['#e91e8c', '#f2c230'], 40, 50, 4.5); },
    hatBack(ctx, R) { featherFan(ctx, R, 13, 150, 0.62 * R, 1.32 * R, ['#e91e8c', '#f2c230', '#00bcd4', '#8e24aa'], -0.3 * R); },
    hat(ctx, R) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.58 * R, 0.98 * R, 0.18 * R, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.lineWidth = 0.18 * R; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 0.13 * R; ctx.strokeStyle = '#f2c230'; ctx.stroke(); ctx.restore();
      [[-0.45, '#e91e8c'], [0, '#00bcd4'], [0.45, '#43a047']].forEach(([x, c]) => ell(ctx, x * R, -0.74 * R, 0.07 * R, 0.07 * R, c, 2)); },
  },
  turista: { armStyle: 'black', boot: '#151515', sleeve: '#3f7bd6',
    torso(ctx, lift) { const t = T0(lift); ctx.fillStyle = '#3f7bd6'; ctx.fillRect(-90, t - 5, 180, 170); ctx.strokeStyle = '#2f62b3'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, t - 6, 26, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); },
  },
});
COSTUMES.presidente_fedora = Object.assign({}, COSTUMES.presidente, {
  hat(ctx, R) { ell(ctx, 0, -0.66 * R, 1.06 * R, 0.19 * R, '#3a3f47', 5);
    shape(ctx, [[-0.62 * R, -0.68 * R], [0.62 * R, -0.68 * R], [0.55 * R, -1.1 * R], [0.16 * R, -1.18 * R], [0, -1.06 * R], [-0.16 * R, -1.18 * R], [-0.55 * R, -1.1 * R]], '#474d56', 5);
    ctx.fillStyle = '#161616'; ctx.fillRect(-0.6 * R, -0.82 * R, 1.2 * R, 0.12 * R); },
});

/* ---------------- OBJETOS DE CENA (props) v6.2 ----------------
   prop = mão direita (ou propMao: "L"); prop2 = segundo objeto, mão esquerda (ou propMao2: "R").
   Troca de figurino no meio da cena: chave {"t": 8.0, "figurino": "pirata"} (combine com o efeito "poeira" para a troca-relâmpago).
   Duas mãos: mapa, bateia, taca, livro, planta, pergaminho, globo, bau.
   Uma mão, na direção do antebraço: espada, katana, cetro, machado, clava, pena, microfone, bola, lupa, telescopio, pao, xicara, laco.
   Uma mão, em pé (vertical): lanca, tridente, bandeira, tocha, mosquete, guarda_chuva.  Pendurado: bengala, saco_dinheiro.
   Escudos (mão esquerda por padrão): escudo, escudo_romano.  Cores: propCores ["#..", ...] (bandeira/escudo). */
const PROPS_DUAS_MAOS = new Set(['mapa', 'bateia', 'taca', 'livro', 'planta', 'pergaminho', 'globo', 'bau', 'presente', 'pizza']);
const PROPS_VERTICAL = new Set(['lanca', 'tridente', 'bandeira', 'tocha', 'mosquete', 'guarda_chuva', 'cajado']);
const PROPS_PENDURADO = new Set(['bengala', 'saco_dinheiro']);
const PROPS_ESCUDO = new Set(['escudo', 'escudo_romano']);
const PROP_NAMES = ['mapa', 'bateia', 'taca', 'livro', 'planta', 'pergaminho', 'globo', 'bau', 'espada', 'katana', 'cetro', 'machado', 'clava', 'pena', 'microfone', 'bola',
  'lupa', 'telescopio', 'pao', 'xicara', 'laco', 'lanca', 'tridente', 'bandeira', 'tocha', 'mosquete', 'guarda_chuva', 'bengala', 'saco_dinheiro', 'escudo', 'escudo_romano',
  'presente', 'pizza', 'cajado', 'garrafa', 'coracao', 'flores', 'trevo'];
function drawPropTwoHands(ctx, name, rot, cores) {
  ctx.save(); ctx.rotate((rot || 0) * D2R);
  if (name === 'mapa') drawMapProp(ctx, 150, 100, 0);
  else if (name === 'bateia') { ell(ctx, 0, 8, 74, 24, '#6b4a2b', 4); ell(ctx, 0, 4, 60, 15, '#8a6236', 3);
    [[-22, 2], [-6, 6], [10, 1], [24, 5], [2, -3], [-14, -2]].forEach(([x, y]) => ell(ctx, x, y, 6, 4.5, GOLD, 2)); }
  else if (name === 'taca') { ctx.translate(0, -24); shape(ctx, [[-36, -64], [36, -64], [26, -16], [9, -2], [9, 18], [24, 30], [-24, 30], [-9, 18], [-9, -2], [-26, -16]], GOLD, 5);
    for (const sd of [-1, 1]) { ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(sd * 38, -46, 15, sd < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, sd < 0 ? Math.PI * 1.5 : Math.PI * 0.5); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3.5; ctx.stroke(); } ctx.fillStyle = '#fff6c2'; ctx.fillRect(-20, -54, 6, 30); }
  else if (name === 'livro') { shape(ctx, [[-52, -36], [52, -36], [52, 36], [-52, 36]], '#7b3f1d', 4); ctx.fillStyle = '#fbf4e0'; ctx.fillRect(42, -30, 6, 60); ctx.fillStyle = '#e1b04b'; ctx.fillRect(-36, -8, 60, 6); }
  else if (name === 'planta') { shape(ctx, [[-84, -54], [84, -54], [84, 54], [-84, 54]], '#2b5fa8', 4);
    ctx.strokeStyle = '#eaf2ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, 4); ctx.lineTo(62, 4); ctx.moveTo(30, -38); ctx.quadraticCurveTo(10, 4, 30, 44); ctx.moveTo(-54, -10); ctx.lineTo(-54, 18); ctx.stroke();
    ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.rect(-74, -44, 148, 88); ctx.stroke(); ctx.setLineDash([]); }
  else if (name === 'pergaminho') { shape(ctx, [[-70, -46], [70, -46], [70, 46], [-70, 46]], '#f1dfb0', 4); for (const sd of [-1, 1]) ell(ctx, sd * 74, 0, 12, 52, '#d9b77a', 4);
    ctx.strokeStyle = 'rgba(60,40,20,0.55)'; ctx.lineWidth = 3; for (let y = -28; y <= 28; y += 14) { ctx.beginPath(); ctx.moveTo(-50, y); ctx.lineTo(50 - (y === 28 ? 40 : 0), y); ctx.stroke(); } }
  else if (name === 'globo') { ctx.translate(0, -30); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 52); ctx.lineTo(0, 74); ctx.stroke(); ell(ctx, 0, 78, 34, 9, '#7b3f1d', 4);
    ell(ctx, 0, 0, 52, 52, '#5fa8d6', 5); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.clip(); ctx.fillStyle = '#5fae5a';
    [[-22, -14, 20, 26], [18, 8, 16, 22], [6, -30, 14, 10], [-30, 24, 12, 10]].forEach(([x, y, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.3, 0, TAU); ctx.fill(); }); ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 60, -Math.PI * 0.9, Math.PI * 0.4); ctx.stroke(); }
  else if (name === 'presente') { shape(ctx, [[-50, -40], [50, -40], [50, 40], [-50, 40]], (cores && cores[0]) || '#2e9d5a', 5); ctx.fillStyle = (cores && cores[1]) || '#c62828'; ctx.fillRect(-9, -40, 18, 80); ctx.fillRect(-50, -9, 100, 18);
    for (const sd of [-1, 1]) ell(ctx, sd * 16, -50, 16, 10, (cores && cores[1]) || '#c62828', 3, sd * 0.4); }
  else if (name === 'pizza') { ell(ctx, 0, 0, 66, 66, '#e0a84e', 5); ell(ctx, 0, 0, 54, 54, '#d64a2a', 0); ctx.fillStyle = '#fff3c4'; [[-20, -18], [18, -24], [-26, 16], [14, 20], [0, 0], [30, 2]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 13, 10, 0.5, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#b3202a'; [[-6, -34], [34, -6], [-34, -2], [8, 34]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); }); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * Math.PI / 4) * 66, Math.sin(i * Math.PI / 4) * 66); ctx.stroke(); } }
  else if (name === 'bau') { shape(ctx, [[-66, -30], [66, -30], [66, 44], [-66, 44]], '#7b4a22', 5); ctx.beginPath(); ctx.ellipse(0, -30, 66, 26, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#8a5a2e'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = GOLD; for (const x of [-50, 50]) ctx.fillRect(x - 5, -54, 10, 98); ctx.fillRect(-12, -36, 24, 18); [[-30, -48], [-10, -56], [14, -52], [32, -46]].forEach(([x, y]) => ell(ctx, x, y, 9, 9, GOLD, 2)); }
  ctx.restore();
}
function drawPropOneHand(ctx, name, A, cores) {
  ctx.save(); ctx.translate(A.H[0], A.H[1]);
  const stick = (x0, y0, x1, y1, w, c) => { ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = w + 6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); };
  if (PROPS_VERTICAL.has(name)) {
    if (name === 'lanca') { stick(0, 70, 0, -200, 7, '#8a5a2e'); shape(ctx, [[0, -236], [10, -204], [0, -196], [-10, -204]], METAL, 4); }
    else if (name === 'tridente') { stick(0, 70, 0, -180, 7, '#8a5a2e'); ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-24, -230); ctx.lineTo(-24, -186); ctx.quadraticCurveTo(-24, -176, 0, -176); ctx.quadraticCurveTo(24, -176, 24, -186); ctx.lineTo(24, -230); ctx.moveTo(0, -240); ctx.lineTo(0, -176); ctx.stroke();
      ctx.strokeStyle = METAL; ctx.lineWidth = 4.5; ctx.stroke(); }
    else if (name === 'bandeira') { stick(0, 70, 0, -230, 6, '#8a6236'); const cs = cores && cores.length ? cores : ['#c62828'];
      ctx.save(); ctx.beginPath(); ctx.moveTo(4, -226); ctx.quadraticCurveTo(60, -240, 120, -222); ctx.lineTo(120, -150); ctx.quadraticCurveTo(60, -168, 4, -154); ctx.closePath(); ctx.clip();
      cs.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(4, -246 + i * (100 / cs.length), 120, 100 / cs.length + 1); }); ctx.restore();
      ctx.beginPath(); ctx.moveTo(4, -226); ctx.quadraticCurveTo(60, -240, 120, -222); ctx.lineTo(120, -150); ctx.quadraticCurveTo(60, -168, 4, -154); ctx.closePath(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ell(ctx, 0, -234, 7, 7, GOLD, 3); }
    else if (name === 'tocha') { stick(0, 50, 0, -110, 9, '#7b4a22'); ell(ctx, 0, -112, 14, 9, '#5b3a1d', 3);
      ctx.beginPath(); ctx.moveTo(-18, -116); ctx.quadraticCurveTo(-26, -160, 2, -196); ctx.quadraticCurveTo(4, -168, 22, -150); ctx.quadraticCurveTo(26, -128, 18, -116); ctx.closePath(); ctx.fillStyle = '#ff9f1c'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, -118); ctx.quadraticCurveTo(-10, -146, 4, -164); ctx.quadraticCurveTo(10, -138, 8, -118); ctx.closePath(); ctx.fillStyle = '#ffe066'; ctx.fill(); }
    else if (name === 'cajado') { stick(0, 80, 0, -262, 7, GOLD); ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(24, -262, 24, Math.PI, Math.PI * 2.3, false); ctx.stroke(); ctx.strokeStyle = GOLD; ctx.lineWidth = 7; ctx.stroke(); }
    else if (name === 'mosquete') { stick(0, 80, 0, -180, 9, '#6b4423'); stick(-2, -140, -2, -230, 4, '#555'); ctx.fillStyle = '#9aa1a8'; ctx.fillRect(-7, -60, 14, 22); }
    else if (name === 'guarda_chuva') { stick(0, 40, 0, -170, 5, '#3a2312'); ctx.save(); ctx.beginPath(); ctx.moveTo(-110, -150); ctx.quadraticCurveTo(-100, -250, 0, -256); ctx.quadraticCurveTo(100, -250, 110, -150);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(110 - i * 55 - 27, -170, 110 - (i + 1) * 55, -150); ctx.closePath(); ctx.fillStyle = cores && cores[0] || '#1b1b1b'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
    ctx.restore(); return;
  }
  if (PROPS_PENDURADO.has(name)) {
    if (name === 'bengala') { stick(0, -10, 0, 150, 6, '#3a2312'); ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(-14, -10, 14, 0, Math.PI, true); ctx.stroke(); ctx.strokeStyle = '#3a2312'; ctx.lineWidth = 6; ctx.stroke(); }
    else if (name === 'saco_dinheiro') { ctx.beginPath(); ctx.moveTo(-10, 8); ctx.quadraticCurveTo(-56, 40, -44, 84); ctx.quadraticCurveTo(0, 104, 44, 84); ctx.quadraticCurveTo(56, 40, 10, 8); ctx.closePath(); ctx.fillStyle = '#c9a15a'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = '#2f7a3a'; ctx.font = `44px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 58); ell(ctx, 0, 8, 14, 7, '#8a6236', 3); }
    ctx.restore(); return;
  }
  if (PROPS_ESCUDO.has(name)) {
    if (name === 'escudo') { const c = cores && cores[0] || '#b3202a'; ell(ctx, 0, 0, 54, 54, METAL, 5); ell(ctx, 0, 0, 44, 44, c, 3); if (cores && cores[1]) { ctx.fillStyle = cores[1]; ctx.fillRect(-44, -8, 88, 16); } ell(ctx, 0, 0, 12, 12, GOLD, 3); }
    else { const c = cores && cores[0] || '#b3202a'; ctx.save(); rr(ctx, -42, -66, 84, 132, 16); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.strokeRect(-34, -58, 68, 116); ell(ctx, 0, 0, 14, 14, GOLD, 3); ctx.beginPath(); ctx.moveTo(-30, -20); ctx.lineTo(30, 20); ctx.moveTo(30, -20); ctx.lineTo(-30, 20); ctx.stroke(); }
    ctx.restore(); return;
  }
  ctx.rotate(Math.atan2(A.dir[1], A.dir[0]));
  if (name === 'espada') { ctx.fillStyle = '#5b3a1d'; ctx.fillRect(-20, -5, 22, 10); shape(ctx, [[10, -7], [150, -5], [170, 0], [150, 5], [10, 7]], '#dfe4ea', 4); shape(ctx, [[2, -22], [12, -22], [12, 22], [2, 22]], GOLD, 3); }
  else if (name === 'katana') { ctx.fillStyle = '#1b1b1b'; ctx.fillRect(-26, -5, 30, 10); ell(ctx, 6, 0, 6, 15, GOLD, 3);
    ctx.beginPath(); ctx.moveTo(12, -5); ctx.quadraticCurveTo(90, -14, 170, -26); ctx.lineTo(166, -18); ctx.quadraticCurveTo(90, -2, 12, 5); ctx.closePath(); ctx.fillStyle = '#e6eaef'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); }
  else if (name === 'cetro') { stick(-24, 0, 112, 0, 8, GOLD); ell(ctx, 124, 0, 15, 15, GOLD, 4); }
  else if (name === 'machado') { stick(-26, 0, 104, 0, 8, '#8a5a2e'); shape(ctx, [[84, -6], [108, -34], [122, -30], [114, 0], [122, 30], [108, 34], [84, 6]], METAL, 4); }
  else if (name === 'clava') { ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(70, -18); ctx.quadraticCurveTo(110, -24, 112, 0); ctx.quadraticCurveTo(110, 24, 70, 18); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fillStyle = '#7b4a22'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); }
  else if (name === 'pena') { ctx.save(); ctx.rotate(-0.9); ell(ctx, 44, 0, 40, 10, WHITE, 3); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(84, 0); ctx.stroke(); ctx.restore(); }
  else if (name === 'microfone') { stick(-8, 0, 40, 0, 8, '#555'); ell(ctx, 60, 0, 22, 17, '#c9ced6', 4); ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(52 + i * 6, -12); ctx.lineTo(52 + i * 6, 12); ctx.stroke(); } }
  else if (name === 'bola') { ell(ctx, 30, 0, 26, 26, '#fbfbfb', 4); ctx.fillStyle = INK; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.lineTo(30 + Math.cos(a) * 9, Math.sin(a) * 9); } ctx.closePath(); ctx.fill(); }
  else if (name === 'lupa') { stick(-6, 0, 44, 0, 7, '#3a2312'); ell(ctx, 74, 0, 28, 28, 'rgba(190,225,255,0.35)', 6); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(74, 0, 18, 3.6, 4.6); ctx.stroke(); }
  else if (name === 'telescopio') { shape(ctx, [[-10, -9], [70, -12], [70, 12], [-10, 9]], '#b8862f', 4); shape(ctx, [[70, -15], [140, -17], [140, 17], [70, 15]], '#d9a441', 4); ell(ctx, 140, 0, 5, 17, '#5fa8d6', 3); }
  else if (name === 'pao') { ctx.save(); ctx.rotate(-0.5); ell(ctx, 50, 0, 70, 14, '#d9a35a', 4); ctx.strokeStyle = '#a86e2e'; ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(40 + i * 22, -8); ctx.lineTo(52 + i * 22, 8); ctx.stroke(); } ctx.restore(); }
  else if (name === 'xicara') { ctx.rotate(-Math.atan2(A.dir[1], A.dir[0])); ell(ctx, 0, -2, 30, 8, WHITE, 3); shape(ctx, [[-20, -36], [20, -36], [14, -6], [-14, -6]], WHITE, 4);
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(24, -24, 9, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.fillStyle = '#7b4a22'; ctx.fillRect(-17, -34, 34, 5);
    ctx.strokeStyle = 'rgba(120,120,120,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -44); ctx.quadraticCurveTo(6, -56, -2, -68); ctx.stroke(); }
  else if (name === 'garrafa') { ctx.rotate(-Math.atan2(A.dir[1], A.dir[0])); ctx.translate(0, -30); shape(ctx, [[-14, 30], [-16, -10], [-7, -34], [-7, -52], [7, -52], [7, -34], [16, -10], [14, 30]], (cores && cores[0]) || '#5a2a1a', 4);
    ctx.fillStyle = (cores && cores[1]) || '#c62828'; ctx.fillRect(-15, -6, 30, 18); ell(ctx, 0, -54, 9, 4, '#c9ced6', 2); }
  else if (name === 'coracao') { ctx.rotate(-Math.atan2(A.dir[1], A.dir[0])); ctx.translate(0, -44); ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -6, -36, -54, 0, -24); ctx.bezierCurveTo(36, -54, 60, -6, 0, 30); ctx.closePath();
    ctx.fillStyle = (cores && cores[0]) || '#e53950'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); }
  else if (name === 'flores') { ctx.rotate(-Math.atan2(A.dir[1], A.dir[0])); ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 4; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(i * 12, -50); ctx.stroke(); }
    [[-24, -54, '#e53950'], [0, -62, '#f2c230'], [24, -54, '#e53950'], [-12, -74, '#f48fb1'], [12, -74, '#ffffff']].forEach(([x, y, c]) => ell(ctx, x, y, 13, 13, c, 3)); shape(ctx, [[-16, -10], [16, -10], [8, 22], [-8, 22]], '#c9a15a', 3); }
  else if (name === 'trevo') { ctx.rotate(-Math.atan2(A.dir[1], A.dir[0])); ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -40); ctx.stroke();
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * 1.2; ctx.save(); ctx.translate(4 + Math.cos(a) * 18, -40 + Math.sin(a) * 18); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-22, -4, -10, -26, 0, -10); ctx.bezierCurveTo(10, -26, 22, -4, 0, 14); ctx.fillStyle = '#2e9d5a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); } }
  else if (name === 'laco') { ctx.rotate(-Math.atan2(A.dir[1], A.dir[0])); ctx.strokeStyle = INK; ctx.lineWidth = 9; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(20, 30, 30 - k * 4, 44 - k * 5, 0.3, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 4.5; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(20, 30, 30 - k * 4, 44 - k * 5, 0.3, 0, TAU); ctx.stroke(); } }
  ctx.restore();
}


/* ================= GUARDA-ROUPA MODULAR v6.2 =================
   Um figurino é uma combinação de peças. Use um PRESET pelo nome (ex.: "legionario") ou crie o seu
   no episode.json, em "figurinos": { "meu_figurino": { ...peças... } }:
   tronco {tipo, cor, cor2, cor3, emblema} · frente [{tipo, cor, cor2, cores}] · baixo {tipo, cor, cor2}
   costas {tipo, cor, borda} · chapeu {tipo, cor, cor2, estilo} · rosto [{tipo, cor, estilo}]
   manga (cor) · bota (cor) · bracos ("preto" | "branco") */
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => clamp(Math.round(v * k), 0, 255);
  return '#' + ((1 << 24) + (f(n >> 16) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1); };
const GOLD = '#f2c230', METAL = '#b8c0c8', BRONZE = '#c98b3a', WHITE = '#fbfbf4';
function wline(ctx, pts, color, w) { ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.strokeStyle = INK; ctx.lineWidth = w + 6; ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); ctx.restore(); }
function halfDome(ctx, y, rx, ry, fill, lw = 5) { ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); } }

/* ---------- TRONCO (desenhado recortado no formato do tronco) ---------- */
const TORSO = {
  liso(ctx, t, p) { ctx.fillStyle = p.cor || '#f2f2f2'; ctx.fillRect(-90, t - 5, 180, 170); },
  listras_h(ctx, t, p) { TORSO.liso(ctx, t, p); ctx.fillStyle = p.cor2 || WHITE; for (let y = t + 8; y < -140; y += 24) ctx.fillRect(-90, y, 180, 11); },
  listras_v(ctx, t, p) { TORSO.liso(ctx, t, p); ctx.fillStyle = p.cor2 || WHITE; for (let x = -84; x < 90; x += 26) ctx.fillRect(x, t - 5, 12, 170); },
  xadrez(ctx, t, p) { TORSO.liso(ctx, t, p); ctx.globalAlpha = 0.45; ctx.fillStyle = p.cor2 || '#222';
    for (let x = -84; x < 90; x += 30) ctx.fillRect(x, t - 5, 12, 170); for (let y = t + 4; y < -140; y += 30) ctx.fillRect(-90, y, 180, 12); ctx.globalAlpha = 1; },
  colete(ctx, t, p) { TORSO.liso(ctx, t, p); ctx.fillStyle = p.cor2 || '#6b4a2b'; ctx.fillRect(-90, t - 5, 70, 170); ctx.fillRect(20, t - 5, 70, 170);
    if (p.cor3) dots(ctx, [-28, 28], t + 50, 3, 24, p.cor3, 4); },
  terno(ctx, t, p) { TORSO.liso(ctx, t, { cor: p.cor || '#2b2f36' }); shape(ctx, [[-24, t - 4], [24, t - 4], [0, t + 74]], p.cor3 || WHITE, 3);
    if (p.cor2) shape(ctx, [[-7, t + 6], [7, t + 6], [10, t + 60], [0, t + 74], [-10, t + 60]], p.cor2, 2.5);
    ctx.strokeStyle = shade(p.cor || '#2b2f36', 0.6); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, t); ctx.lineTo(-2, t + 96); ctx.moveTo(24, t); ctx.lineTo(2, t + 96); ctx.stroke(); },
  uniforme(ctx, t, p) { TORSO.liso(ctx, t, p); dots(ctx, p.colunas === 2 ? [-16, 16] : [0], t + 36, 5, 20, p.cor2 || GOLD, 4.5);
    if (p.cor3) { ctx.fillStyle = p.cor3; ctx.fillRect(-28, t - 5, 18, 18); ctx.fillRect(10, t - 5, 18, 18); } },
  toga(ctx, t, p) { TORSO.liso(ctx, t, p); ctx.save(); ctx.lineCap = 'butt';
    ctx.strokeStyle = shade(p.cor || WHITE, 0.86); ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(-74, t - 14); ctx.lineTo(74, -150); ctx.stroke();
    if (p.cor2) { ctx.strokeStyle = p.cor2; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-92, t + 6); ctx.lineTo(54, -132); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 24, t + 20 + i * 18); ctx.quadraticCurveTo(-10 + i * 24, t + 60 + i * 18, -30 + i * 24, t + 110); ctx.stroke(); } ctx.restore(); },
  armadura(ctx, t, p) { ctx.fillStyle = p.cor2 || '#b3202a'; ctx.fillRect(-90, t - 5, 180, 170); const m = p.cor || METAL;
    for (let i = 0; i < 5; i++) { const y = t + 4 + i * 23; ctx.fillStyle = i % 2 ? m : shade(m, 0.88); ctx.fillRect(-90, y, 180, 21); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-90, y + 19, 180, 2.5); } },
  cota_malha(ctx, t, p) { const c = p.cor || '#9aa1a8'; ctx.fillStyle = c; ctx.fillRect(-90, t - 5, 180, 170); ctx.strokeStyle = shade(c, 0.68); ctx.lineWidth = 1.6;
    for (let y = t, r = 0; y < -136; y += 8, r++) for (let x = -92; x < 92; x += 10) { ctx.beginPath(); ctx.arc(x + (r % 2 ? 5 : 0), y, 4, 0, Math.PI); ctx.stroke(); } },
  tabardo(ctx, t, p) { TORSO.cota_malha(ctx, t, {}); ctx.fillStyle = p.cor || WHITE; ctx.fillRect(-44, t - 5, 88, 170);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-44, t - 5, 88, 170);
    const e = p.emblema || 'cruz', c2 = p.cor2 || '#c62828';
    if (e === 'cruz') { ctx.fillStyle = c2; ctx.fillRect(-9, t + 20, 18, 96); ctx.fillRect(-34, t + 50, 68, 18); }
    else if (e === 'chevron') { ctx.strokeStyle = c2; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-34, t + 90); ctx.lineTo(0, t + 50); ctx.lineTo(34, t + 90); ctx.stroke(); }
    else if (e === 'leao') { ctx.fillStyle = c2; star(ctx, 0, t + 70, 22); } },
  kimono(ctx, t, p) { TORSO.liso(ctx, t, p); ctx.save(); ctx.lineCap = 'butt'; ctx.strokeStyle = p.cor2 || WHITE; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(-46, t - 8); ctx.lineTo(12, t + 76); ctx.moveTo(46, t - 8); ctx.lineTo(-6, t + 62); ctx.stroke(); ctx.restore();
    ctx.fillStyle = p.cor3 || '#c0392b'; ctx.fillRect(-90, -200, 180, 34); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-90, -186, 180, 5); },
  kaftan(ctx, t, p) { TORSO.liso(ctx, t, p); const c2 = p.cor2 || GOLD; ctx.fillStyle = c2; ctx.fillRect(-6, t - 5, 12, 170); ctx.fillRect(-90, -188, 180, 10);
    dots(ctx, [-30, 30], t + 40, 4, 24, c2, 4); },
  pele(ctx, t, p) { const c = p.cor || '#8a5a2e'; TORSO.liso(ctx, t, { cor: c }); ctx.strokeStyle = shade(c, 1.3); ctx.lineWidth = 3;
    for (let r = 0; r < 6; r++) for (let k = 0; k < 6; k++) { const x = -80 + k * 30 + (r % 2) * 15, y = t + 10 + r * 26; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 10); ctx.lineTo(x + 6, y); ctx.stroke(); }
    ctx.fillStyle = '#fbfbfb'; ctx.beginPath(); ctx.moveTo(-90, t - 5); ctx.lineTo(-20, t - 5); ctx.lineTo(-90, t + 70); ctx.closePath(); ctx.fill(); },
  jaleco(ctx, t, p) { TORSO.liso(ctx, t, { cor: p.cor || '#f7f7f7' }); shape(ctx, [[-24, t - 4], [24, t - 4], [0, t + 64]], p.cor2 || '#7fb3e6', 3);
    ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-24, t); ctx.lineTo(-4, t + 100); ctx.moveTo(24, t); ctx.lineTo(4, t + 100); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(22, t + 56, 34, 26); ctx.strokeStyle = '#2f6fd6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(32, t + 48); ctx.lineTo(32, t + 66); ctx.stroke(); },
  macacao(ctx, t, p) { TORSO.liso(ctx, t, { cor: p.cor || '#c94a3a' }); const d = p.cor2 || '#3b5f9e'; ctx.fillStyle = d; ctx.fillRect(-46, t + 44, 92, 130);
    ctx.strokeStyle = d; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-44, t - 5); ctx.lineTo(-34, t + 50); ctx.moveTo(44, t - 5); ctx.lineTo(34, t + 50); ctx.stroke(); dots(ctx, [-34, 34], t + 50, 1, 0, GOLD, 5); },
  sem_camisa(ctx, t) { ctx.fillStyle = '#fbfbfb'; ctx.fillRect(-90, t - 5, 180, 170); },
  espacial(ctx, t, p) { TORSO.liso(ctx, t, { cor: '#eef1f5' }); ctx.fillStyle = '#d3d8df'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillRect(-32, t + 42, 64, 44); ctx.strokeRect(-32, t + 42, 64, 44);
    ['#d6303a', '#2f6fd6', '#2f9e5a'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-16 + i * 16, t + 64, 5.5, 0, TAU); ctx.fill(); });
    if (p.cor2) { ctx.fillStyle = p.cor2; ctx.fillRect(-72, t + 14, 30, 18); ctx.strokeRect(-72, t + 14, 30, 18); } },
  lantejoula(ctx, t, p) { TORSO.liso(ctx, t, { cor: p.cor || '#8e24aa' }); const cs = [p.cor2 || GOLD, p.cor3 || '#e91e8c', '#00bcd4'];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { ctx.save(); ctx.translate(-78 + c * 26 + (r % 2) * 13, t + 12 + r * 26); ctx.rotate(Math.PI / 4); ctx.fillStyle = cs[(r + c) % 3]; ctx.fillRect(-7, -7, 14, 14); ctx.restore(); } },
  arlequim(ctx, t, p) { TORSO.liso(ctx, t, { cor: p.cor || '#d6303a' }); ctx.fillStyle = p.cor2 || GOLD; ctx.fillRect(0, t - 5, 90, 170);
    dots(ctx, [0], t + 40, 4, 26, INK, 6); },
};
/* ---------- PARTE DE BAIXO (sobre as pernas) ---------- */
const LOWER = {
  saia_curta(ctx, p) { shape(ctx, [[-62, -168], [62, -168], [74, -96], [-74, -96]], p.cor || '#b3202a', 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 17, -164); ctx.lineTo(i * 20, -99); ctx.stroke(); } },
  shendyt(ctx, p) { shape(ctx, [[-60, -168], [60, -168], [70, -98], [-70, -98]], p.cor || WHITE, 4); shape(ctx, [[-22, -168], [22, -168], [0, -100]], p.cor2 || GOLD, 3); },
  kilt(ctx, p) { LOWER.saia_curta(ctx, p); ctx.save(); ctx.beginPath(); ctx.moveTo(-62, -168); ctx.lineTo(62, -168); ctx.lineTo(74, -96); ctx.lineTo(-74, -96); ctx.closePath(); ctx.clip();
    ctx.globalAlpha = 0.55; ctx.fillStyle = p.cor2 || '#1f6b3a'; for (let x = -80; x < 80; x += 26) ctx.fillRect(x, -170, 10, 80); for (let y = -160; y < -96; y += 22) ctx.fillRect(-80, y, 160, 8); ctx.restore(); },
  vestido(ctx, p) { ctx.beginPath(); ctx.moveTo(-58, -168); ctx.lineTo(58, -168); ctx.quadraticCurveTo(96, -90, 120, -14); ctx.quadraticCurveTo(0, 6, -120, -14); ctx.quadraticCurveTo(-96, -90, -58, -168); ctx.closePath();
    ctx.fillStyle = p.cor || '#2f5fae'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    if (p.cor2) { ctx.strokeStyle = p.cor2; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-110, -30); ctx.quadraticCurveTo(0, -10, 110, -30); ctx.stroke(); } },
  manto_longo(ctx, p) { shape(ctx, [[-62, -170], [62, -170], [84, -8], [-84, -8]], p.cor || WHITE, 4); ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-10, -165); ctx.lineTo(-18, -12); ctx.moveTo(24, -165); ctx.lineTo(36, -12); ctx.stroke(); if (p.cor2) { ctx.fillStyle = p.cor2; ctx.fillRect(-82, -24, 164, 10); } },
  hakama(ctx, p) { shape(ctx, [[-64, -176], [64, -176], [98, -8], [10, -8], [0, -70], [-10, -8], [-98, -8]], p.cor || '#2b2b3a', 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; for (const x of [-60, -36, 36, 60]) { ctx.beginPath(); ctx.moveTo(x * 0.7, -170); ctx.lineTo(x * 1.2, -14); ctx.stroke(); } },
  short(ctx, p) { shape(ctx, [[-64, -160], [64, -160], [66, -98], [8, -98], [0, -118], [-8, -98], [-66, -98]], p.cor || '#1d4fa3', 4); },
  saia_fibra(ctx, p) { ctx.fillStyle = p.cor || '#c9a15a'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-62, -160);
    for (let i = 0; i <= 10; i++) ctx.lineTo(-62 + i * 12.4, -100 - (i % 2) * 10); ctx.lineTo(62, -160); ctx.closePath(); ctx.fill(); ctx.stroke(); },
};
/* ---------- COSTAS (capas) ---------- */
function capeShort(ctx, lift, color) { const t = RIG.torsoTop + lift; shape(ctx, [[-56, t + 8], [56, t + 8], [104, -130], [0, -122], [-104, -130]], color, 5); }
const BACK = {
  capa(ctx, lift, p) { capeBack(ctx, lift, p.cor || '#a3192a', p.borda);
    if (p.borda === 'ouro') { ctx.strokeStyle = GOLD; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-126, -24); ctx.quadraticCurveTo(-66, 2, 0, 2); ctx.quadraticCurveTo(66, 2, 126, -24); ctx.stroke(); }
    if (p.borda === 'pele') { for (let i = -6; i <= 6; i++) ell(ctx, i * 20, -8 - Math.abs(i) * 1.6, 13, 11, '#d9c7a6', 2); } },
  capa_curta(ctx, lift, p) { capeShort(ctx, lift, p.cor || '#a3192a'); if (p.borda === 'pele') for (let i = -5; i <= 5; i++) ell(ctx, i * 20, -126 - Math.abs(i) * 0.6, 12, 10, '#d9c7a6', 2); },
};
/* ---------- FRENTE (gola, colar, faixa, distintivos) ---------- */
const FRONT = {
  gravata(ctx, t, p) { shape(ctx, [[-7, t + 6], [7, t + 6], [10, t + 60], [0, t + 74], [-10, t + 60]], p.cor || '#8b1e2b', 2.5); },
  gravata_borboleta(ctx, t, p) { const c = p.cor || '#1b1b1b'; shape(ctx, [[0, t + 10], [-24, t], [-24, t + 22]], c, 3); shape(ctx, [[0, t + 10], [24, t], [24, t + 22]], c, 3); ell(ctx, 0, t + 10, 6, 6, c, 2.5); },
  bandana(ctx, t, p) { shape(ctx, [[-28, t + 2], [28, t + 2], [0, t + 36]], p.cor || '#c0392b', 3); },
  rufo(ctx, t) { ctx.fillStyle = WHITE; ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(i * 13, t + 4, 9, 12, 0, 0, TAU); ctx.fill(); ctx.stroke(); } },
  arminho(ctx, t) { ermine(ctx, [[-58, t + 4], [-30, t + 26], [0, t + 32], [30, t + 26], [58, t + 4]], 16); },
  colar(ctx, t, p) { necklace(ctx, t, p.cores || [p.cor || '#c0392b', WHITE]); },
  perolas(ctx, t) { necklace(ctx, t + 4, [WHITE], 24, 32, 4.5); },
  faixa(ctx, t, p) { ctx.save(); ctx.strokeStyle = p.cor || GOLD; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-56, t + 8); ctx.lineTo(56, -168); ctx.stroke();
    if (p.cor2) { ctx.strokeStyle = p.cor2; ctx.lineWidth = 4; ctx.stroke(); } ctx.restore(); },
  medalha(ctx, t, p) { ctx.fillStyle = p.cor || GOLD; star(ctx, -34, t + 66, 13); },
  estrela_xerife(ctx, t, p) { ctx.fillStyle = p.cor || GOLD; star(ctx, -36, t + 52, 20); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); },
  dragonas(ctx, t, p) { for (const sd of [-1, 1]) { ell(ctx, sd * 52, t + 8, 22, 9, p.cor || GOLD, 3); ctx.strokeStyle = shade(p.cor || GOLD, 0.8); ctx.lineWidth = 2.5;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(sd * 52 + i * 5, t + 14); ctx.lineTo(sd * 52 + i * 5, t + 28); ctx.stroke(); } } },
  cinto_cruzado(ctx, t, p) { const c = p.cor || WHITE; wline(ctx, [[-50, t + 4], [46, -160]], c, 9); wline(ctx, [[50, t + 4], [-46, -160]], c, 9); ell(ctx, 0, t + 72, 12, 12, p.cor2 || GOLD, 3); },
  cinto(ctx, t, p) { ctx.fillStyle = p.cor || '#3a2312'; ctx.fillRect(-64, -190, 128, 15); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-64, -190, 128, 15);
    ctx.fillStyle = p.cor2 || '#c9ced6'; ctx.fillRect(-11, -193, 22, 21); ctx.strokeRect(-11, -193, 22, 21); },
  botoes(ctx, t, p) { dots(ctx, [0], t + 30, 5, 22, p.cor || GOLD, 5); },
  cruz(ctx, t, p) { ctx.fillStyle = p.cor || '#c62828'; ctx.fillRect(-7, t + 26, 14, 56); ctx.fillRect(-24, t + 42, 48, 13); },
  peitoral(ctx, t, p) { const c = p.cor || METAL; shape(ctx, [[-56, t + 4], [56, t + 4], [52, -176], [0, -160], [-52, -176]], c, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, t + 20); ctx.quadraticCurveTo(-38, t + 70, -26, t + 100); ctx.stroke(); },
  ombreiras(ctx, t, p) { for (const sd of [-1, 1]) ell(ctx, sd * 58, t + 12, 27, 17, p.cor || METAL, 4); },
  colar_egipcio(ctx, t, p) { const cs = p.cores || [GOLD, '#1fa2a8', '#c0392b', GOLD]; for (let i = cs.length - 1; i >= 0; i--) {
    ctx.beginPath(); ctx.ellipse(0, t - 2, 34 + i * 9, 22 + i * 9, 0, 0, Math.PI); ctx.lineTo(-34 - i * 9, t - 2); ctx.closePath(); ctx.fillStyle = cs[i]; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); } },
  franjas(ctx, t, p) { ctx.strokeStyle = shade(p.cor || '#a67c52', 0.7); ctx.lineWidth = 3; for (let x = -54; x <= 54; x += 9) { ctx.beginPath(); ctx.moveTo(x, t + 40); ctx.lineTo(x + 2, t + 62); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-58, t + 40); ctx.quadraticCurveTo(0, t + 48, 58, t + 40); ctx.stroke(); },
  kamishimo(ctx, t, p) { for (const sd of [-1, 1]) shape(ctx, [[sd * 20, t - 2], [sd * 96, t - 14], [sd * 92, t + 22], [sd * 30, t + 70]], p.cor || '#2b3a67', 4); },
  emblema_quadrado(ctx, t, p) { shape(ctx, [[-30, t + 40], [30, t + 40], [30, t + 98], [-30, t + 98]], p.cor || GOLD, 3); ctx.fillStyle = p.cor2 || '#c0392b'; star(ctx, 0, t + 69, 14); },
  estetoscopio(ctx, t) { ctx.save(); ctx.strokeStyle = '#333'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-26, t + 2); ctx.quadraticCurveTo(-34, t + 70, 0, t + 80); ctx.quadraticCurveTo(30, t + 70, 26, t + 2); ctx.stroke(); ctx.restore(); ell(ctx, 0, t + 84, 9, 9, '#c9ced6', 3); },
  lenco_pescoco(ctx, t, p) { ell(ctx, 0, t + 6, 30, 12, p.cor || '#c0392b', 3); },
  gola_puritana(ctx, t, p) { shape(ctx, [[-60, t - 2], [60, t - 2], [44, t + 30], [0, t + 40], [-44, t + 30]], p.cor || WHITE, 3); },
  cartucheira(ctx, t, p) { const c = p.cor || '#6b4a2b'; wline(ctx, [[-50, t + 4], [46, -160]], c, 12); wline(ctx, [[50, t + 4], [-46, -160]], c, 12);
    ctx.fillStyle = GOLD; for (let k = 1; k < 9; k++) { const f = k / 9; for (const [x0, y0, x1, y1] of [[-50, t + 4, 46, -160], [50, t + 4, -46, -160]]) { ctx.fillRect(lerp(x0, x1, f) - 2.5, lerp(y0, y1, f) - 7, 5, 9); } } },
  pele_branca(ctx, t) { ermine(ctx, [[-56, t + 4], [-20, t + 22], [20, t + 22], [56, t + 4]], 18); ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, t + 20); ctx.lineTo(0, -142); ctx.stroke();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 18; ctx.stroke(); ctx.restore(); },
  gola_alta(ctx, t, p) { shape(ctx, [[-26, t - 16], [26, t - 16], [28, t + 6], [-28, t + 6]], p.cor || WHITE, 3); },
};
/* ---------- ROSTO (barba, bigode, óculos, tapa-olho, cabelo) ---------- */
const FACE = {
  barba(ctx, R, p) { const c = p.cor || '#3a2a1a', s = p.estilo || 'cheia';
    if (s === 'longa') return COSTUMES.pedro_ii.face(ctx, R);
    ctx.save(); ctx.beginPath();
    if (s === 'cavanhaque') { ctx.moveTo(-0.16 * R, 0.55 * R); ctx.quadraticCurveTo(0, 1.02 * R, 0.16 * R, 0.55 * R); ctx.closePath(); }
    else if (s === 'curta') { ctx.arc(0, 0, R * 0.98, 0.08 * Math.PI, 0.92 * Math.PI); ctx.arc(0, 0.12 * R, R * 0.78, 0.86 * Math.PI, 0.14 * Math.PI, true); ctx.closePath(); }
    else { ctx.moveTo(-0.74 * R, 0.0); ctx.quadraticCurveTo(-0.8 * R, 0.78 * R, -0.2 * R, 1.06 * R); ctx.quadraticCurveTo(0, 1.16 * R, 0.2 * R, 1.06 * R); ctx.quadraticCurveTo(0.8 * R, 0.78 * R, 0.74 * R, 0);
      ctx.quadraticCurveTo(0.56 * R, 0.58 * R, 0.24 * R, 0.6 * R); ctx.lineTo(-0.24 * R, 0.6 * R); ctx.quadraticCurveTo(-0.56 * R, 0.58 * R, -0.74 * R, 0); ctx.closePath(); }
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    if (s !== 'cavanhaque' && s !== 'curta') FACE.bigode(ctx, R, { cor: c }); },
  bigode(ctx, R, p) { const c = p.cor || '#3a2a1a', s = p.estilo || 'grande';
    if (s === 'fino') { ctx.strokeStyle = c; ctx.lineWidth = 0.05 * R; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.24 * R, 0.33 * R); ctx.quadraticCurveTo(0, 0.24 * R, 0.24 * R, 0.33 * R); ctx.stroke(); return; }
    if (s === 'guidao') { for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.beginPath(); ctx.moveTo(0, 0.27 * R); ctx.quadraticCurveTo(0.25 * R, 0.2 * R, 0.36 * R, 0.32 * R);
      ctx.quadraticCurveTo(0.46 * R, 0.4 * R, 0.5 * R, 0.24 * R); ctx.quadraticCurveTo(0.42 * R, 0.36 * R, 0.3 * R, 0.37 * R); ctx.quadraticCurveTo(0.12 * R, 0.36 * R, 0, 0.33 * R); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); } return; }
    ell(ctx, -0.15 * R, 0.29 * R, 0.18 * R, 0.075 * R, c, 4, -0.2); ell(ctx, 0.15 * R, 0.29 * R, 0.18 * R, 0.075 * R, c, 4, 0.2); },
  tapa_olho(ctx, R) { ctx.strokeStyle = INK; ctx.lineWidth = 0.04 * R; ctx.beginPath(); ctx.moveTo(-0.95 * R, -0.42 * R); ctx.lineTo(0.95 * R, 0.1 * R); ctx.stroke(); ell(ctx, 0.37 * R, -0.04 * R, 0.17 * R, 0.15 * R, '#151515', 3); },
  oculos(ctx, R, p) { ctx.save(); ctx.strokeStyle = p.cor || INK; ctx.lineWidth = 0.045 * R; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 0.37 * R, -0.04 * R, 0.19 * R, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-0.18 * R, -0.06 * R); ctx.quadraticCurveTo(0, -0.14 * R, 0.18 * R, -0.06 * R); ctx.moveTo(-0.56 * R, -0.06 * R); ctx.lineTo(-0.9 * R, -0.14 * R); ctx.moveTo(0.56 * R, -0.06 * R); ctx.lineTo(0.9 * R, -0.14 * R); ctx.stroke(); ctx.restore(); },
  oculos_sol(ctx, R) { for (const sd of [-1, 1]) { ctx.beginPath(); rr(ctx, sd * 0.37 * R - 0.21 * R, -0.18 * R, 0.42 * R, 0.27 * R, 0.1 * R); ctx.fillStyle = '#151515'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 0.045 * R; ctx.beginPath(); ctx.moveTo(-0.16 * R, -0.1 * R); ctx.lineTo(0.16 * R, -0.1 * R); ctx.stroke(); },
  monoculo(ctx, R) { ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 0.045 * R; ctx.beginPath(); ctx.arc(0.37 * R, -0.04 * R, 0.2 * R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.02 * R; ctx.beginPath(); ctx.moveTo(0.37 * R, 0.16 * R); ctx.quadraticCurveTo(0.6 * R, 0.8 * R, 0.4 * R, 1.3 * R); ctx.stroke(); },
};
const HAIR = {
  longo: { back(ctx, R, c) { ctx.beginPath(); ctx.moveTo(-0.95 * R, -0.3 * R); ctx.quadraticCurveTo(-1.2 * R, 0.9 * R, -0.9 * R, 1.5 * R); ctx.lineTo(0.9 * R, 1.5 * R); ctx.quadraticCurveTo(1.2 * R, 0.9 * R, 0.95 * R, -0.3 * R);
      ctx.quadraticCurveTo(0, -1.3 * R, -0.95 * R, -0.3 * R); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); },
    front(ctx, R, c) { ctx.beginPath(); ctx.moveTo(-0.92 * R, -0.3 * R); ctx.quadraticCurveTo(-0.6 * R, -1.08 * R, 0, -0.98 * R); ctx.quadraticCurveTo(0.6 * R, -1.08 * R, 0.92 * R, -0.3 * R);
      ctx.quadraticCurveTo(0.5 * R, -0.62 * R, 0.08 * R, -0.66 * R); ctx.quadraticCurveTo(-0.5 * R, -0.6 * R, -0.92 * R, -0.3 * R); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); } },
  chanel: { back(ctx, R, c) { shape(ctx, [[-1.02 * R, -0.4 * R], [-1.0 * R, 0.62 * R], [1.0 * R, 0.62 * R], [1.02 * R, -0.4 * R], [0, -1.12 * R]], c, 5); },
    front(ctx, R, c) { shape(ctx, [[-0.94 * R, -0.34 * R], [-0.62 * R, -0.92 * R], [0.62 * R, -0.92 * R], [0.94 * R, -0.34 * R], [0.6 * R, -0.5 * R], [-0.6 * R, -0.5 * R]], c, 4);
      shape(ctx, [[-1.02 * R, -0.36 * R], [-0.84 * R, -0.36 * R], [-0.84 * R, 0.6 * R], [-1.02 * R, 0.6 * R]], c, 4); shape(ctx, [[1.02 * R, -0.36 * R], [0.84 * R, -0.36 * R], [0.84 * R, 0.6 * R], [1.02 * R, 0.6 * R]], c, 4); } },
  coque: { back(ctx, R, c) { ell(ctx, 0, -1.02 * R, 0.34 * R, 0.28 * R, c, 5); },
    front(ctx, R, c) { ctx.beginPath(); ctx.moveTo(-0.94 * R, -0.28 * R); ctx.quadraticCurveTo(-0.5 * R, -1.1 * R, 0, -1.0 * R); ctx.quadraticCurveTo(0.5 * R, -1.1 * R, 0.94 * R, -0.28 * R); ctx.quadraticCurveTo(0, -0.7 * R, -0.94 * R, -0.28 * R); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); } },
  rabo: { back(ctx, R, c) { ctx.beginPath(); ctx.moveTo(0.6 * R, -0.6 * R); ctx.quadraticCurveTo(1.5 * R, -0.2 * R, 1.1 * R, 0.9 * R); ctx.quadraticCurveTo(1.0 * R, 0.1 * R, 0.5 * R, -0.3 * R); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); },
    front(ctx, R, c) { HAIR.coque.front(ctx, R, c); } },
};
/* ---------- CHAPÉUS ---------- */
const HAT = {
  coroa(ctx, R, p) { if (p.estilo === 'fechada') { ctx.save(); ctx.translate(0, -0.7 * R); ctx.beginPath(); ctx.ellipse(0, 0, 0.55 * R, 0.62 * R, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = p.cor2 || '#b3202a'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.62 * R); ctx.moveTo(-0.5 * R, -0.1 * R); ctx.quadraticCurveTo(0, -0.9 * R, 0.5 * R, -0.1 * R); ctx.stroke(); ell(ctx, 0, -0.68 * R, 0.1 * R, 0.1 * R, GOLD, 3); ctx.restore();
      ctx.fillStyle = GOLD; ctx.fillRect(-0.56 * R, -0.78 * R, 1.12 * R, 0.14 * R); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-0.56 * R, -0.78 * R, 1.12 * R, 0.14 * R); return; }
    crownShape(ctx, R, -0.7 * R, (p.estilo === 'pequena' ? 0.7 : 1.06) * R, (p.estilo === 'pequena' ? 0.38 : 0.6) * R, p.cor || GOLD); },
  tiara(ctx, R, p) { COSTUMES.princesa.hat(ctx, R); },
  louros(ctx, R, p) { const c = p.cor || '#3f8f3a'; for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { const a = (200 + i * 20) * D2R; const x = sd * Math.cos(a) * -0.9 * R, y = -0.25 * R + Math.sin(a) * 0.62 * R;
      ctx.save(); ctx.translate(x, y); ctx.rotate(sd * (0.6 + i * 0.3)); ell(ctx, 0, 0, 0.09 * R, 0.2 * R, c, 2.5); ctx.restore(); } },
  elmo_romano(ctx, R, p) { const m = p.cor || METAL; halfDome(ctx, -0.42 * R, 1.0 * R, 0.66 * R, m); ctx.fillStyle = shade(m, 0.85); ctx.fillRect(-1.0 * R, -0.48 * R, 2.0 * R, 0.1 * R);
    for (const sd of [-1, 1]) shape(ctx, [[sd * 0.98 * R, -0.42 * R], [sd * 0.7 * R, -0.42 * R], [sd * 0.74 * R, 0.32 * R], [sd * 0.96 * R, 0.2 * R]], m, 4);
    const c = p.cor2 || '#c62828';
    if (p.estilo === 'centuriao') { ctx.save(); ctx.beginPath(); ctx.ellipse(0, -1.04 * R, 1.08 * R, 0.3 * R, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
    else if (p.estilo === 'gladiador') { ell(ctx, 0, -0.44 * R, 1.25 * R, 0.16 * R, m, 4); shape(ctx, [[-0.14 * R, -1.08 * R], [0.14 * R, -1.08 * R], [0.1 * R, -1.5 * R], [-0.1 * R, -1.5 * R]], c, 4); }
    else ell(ctx, 0, -1.22 * R, 0.17 * R, 0.36 * R, c, 4); },
  elmo_grego(ctx, R, p) { const m = p.cor || BRONZE; halfDome(ctx, -0.5 * R, 0.98 * R, 0.6 * R, m); for (const sd of [-1, 1]) shape(ctx, [[sd * 0.97 * R, -0.5 * R], [sd * 0.62 * R, -0.5 * R], [sd * 0.66 * R, 0.1 * R], [sd * 0.95 * R, 0.0]], m, 4);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-0.2 * R, -1.02 * R); ctx.quadraticCurveTo(-0.1 * R, -1.75 * R, 0.85 * R, -1.45 * R); ctx.quadraticCurveTo(0.4 * R, -1.3 * R, 0.2 * R, -1.02 * R); ctx.closePath();
    ctx.fillStyle = p.cor2 || '#c62828'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); },
  elmo_viking(ctx, R, p) { const m = p.cor || '#9aa1a8'; halfDome(ctx, -0.42 * R, 0.98 * R, 0.66 * R, m); ctx.fillStyle = shade(m, 0.8); ctx.fillRect(-0.98 * R, -0.5 * R, 1.96 * R, 0.12 * R);
    shape(ctx, [[-0.07 * R, -0.42 * R], [0.07 * R, -0.42 * R], [0.06 * R, 0.08 * R], [-0.06 * R, 0.08 * R]], m, 3);
    if (p.estilo === 'chifres') for (const sd of [-1, 1]) { ctx.save(); ctx.beginPath(); ctx.moveTo(sd * 0.8 * R, -0.7 * R); ctx.quadraticCurveTo(sd * 1.5 * R, -0.9 * R, sd * 1.35 * R, -1.6 * R);
      ctx.quadraticCurveTo(sd * 1.2 * R, -1.0 * R, sd * 0.7 * R, -0.95 * R); ctx.closePath(); ctx.fillStyle = '#f1e6c8'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); } },
  kabuto(ctx, R, p) { const c = p.cor || '#1b1b1b'; halfDome(ctx, -0.4 * R, 1.0 * R, 0.7 * R, c); for (const sd of [-1, 1]) shape(ctx, [[sd * 0.84 * R, -0.5 * R], [sd * 1.32 * R, -0.66 * R], [sd * 1.28 * R, -0.28 * R], [sd * 0.92 * R, -0.3 * R]], c, 4);
    const g = p.cor2 || GOLD; ctx.save(); ctx.beginPath(); ctx.moveTo(-0.1 * R, -0.98 * R); ctx.quadraticCurveTo(-0.9 * R, -1.3 * R, -0.75 * R, -1.75 * R); ctx.quadraticCurveTo(-0.62 * R, -1.32 * R, 0, -1.12 * R);
    ctx.quadraticCurveTo(0.62 * R, -1.32 * R, 0.75 * R, -1.75 * R); ctx.quadraticCurveTo(0.9 * R, -1.3 * R, 0.1 * R, -0.98 * R); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); ell(ctx, 0, -1.0 * R, 0.1 * R, 0.1 * R, g, 3); },
  nemes(ctx, R, p) { const c1 = p.cor || '#1f4fa3', c2 = p.cor2 || GOLD;
    for (const sd of [-1, 1]) { shape(ctx, [[sd * 0.78 * R, -0.2 * R], [sd * 1.02 * R, -0.1 * R], [sd * 0.86 * R, 1.42 * R], [sd * 0.6 * R, 1.42 * R], [sd * 0.7 * R, 0.3 * R]], c2, 4);
      ctx.fillStyle = c1; for (let k = 0; k < 6; k++) { const y = 0.2 * R + k * 0.2 * R; ctx.fillRect(sd > 0 ? 0.66 * R : -0.94 * R, y, 0.28 * R, 0.08 * R); } }
    ctx.save(); ctx.beginPath(); ctx.moveTo(-1.02 * R, -0.12 * R); ctx.quadraticCurveTo(-1.08 * R, -1.18 * R, 0, -1.12 * R); ctx.quadraticCurveTo(1.08 * R, -1.18 * R, 1.02 * R, -0.12 * R); ctx.lineTo(0.8 * R, -0.42 * R); ctx.quadraticCurveTo(0, -0.62 * R, -0.8 * R, -0.42 * R); ctx.closePath();
    ctx.fillStyle = c2; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.clip(); ctx.fillStyle = c1; for (let k = -6; k <= 6; k += 2) ctx.fillRect(k * 0.16 * R, -1.3 * R, 0.13 * R, 1.3 * R); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-1.02 * R, -0.12 * R); ctx.quadraticCurveTo(-1.08 * R, -1.18 * R, 0, -1.12 * R); ctx.quadraticCurveTo(1.08 * R, -1.18 * R, 1.02 * R, -0.12 * R); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ell(ctx, 0, -0.62 * R, 0.08 * R, 0.12 * R, GOLD, 3); },
  turbante(ctx, R, p) { const c = p.cor || '#f4f1e6'; ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.62 * R, 1.02 * R, 0.62 * R, 0, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    ctx.strokeStyle = shade(c, 0.75); ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.9 * R, -0.62 * R - i * 0.12 * R); ctx.quadraticCurveTo(0, -0.9 * R - i * 0.16 * R, 0.9 * R, -0.7 * R - i * 0.1 * R); ctx.stroke(); }
    if (p.estilo === 'maraja') { ell(ctx, 0, -0.86 * R, 0.13 * R, 0.13 * R, p.cor2 || '#c62828', 3); ctx.save(); ctx.translate(0.05 * R, -1.1 * R); ctx.rotate(0.3); ell(ctx, 0, -0.2 * R, 0.08 * R, 0.3 * R, WHITE, 3); ctx.restore(); } },
  mianguan(ctx, R, p) { ell(ctx, 0, -0.78 * R, 0.6 * R, 0.16 * R, '#1b1b1b', 4); shape(ctx, [[-1.0 * R, -1.02 * R], [1.0 * R, -1.02 * R], [0.96 * R, -0.9 * R], [-0.96 * R, -0.9 * R]], p.cor || '#1b1b1b', 4);
    for (let i = -4; i <= 4; i++) { ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(i * 0.2 * R, -0.9 * R); ctx.lineTo(i * 0.2 * R, -0.45 * R); ctx.stroke(); for (let k = 0; k < 3; k++) ell(ctx, i * 0.2 * R, -0.8 * R + k * 0.15 * R, 0.035 * R, 0.035 * R, k % 2 ? GOLD : '#c62828', 1); } },
  chapeu_qing(ctx, R, p) { ctx.save(); ctx.beginPath(); ctx.moveTo(-1.0 * R, -0.52 * R); ctx.lineTo(0, -1.12 * R); ctx.lineTo(1.0 * R, -0.52 * R); ctx.quadraticCurveTo(0, -0.66 * R, -1.0 * R, -0.52 * R); ctx.closePath(); ctx.fillStyle = p.cor || '#1b1b1b'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = '#c62828'; ctx.lineWidth = 2.5; for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(0, -1.1 * R); ctx.lineTo(i * 0.11 * R, -0.62 * R + Math.abs(i) * 0.01 * R); ctx.stroke(); } ctx.restore(); ell(ctx, 0, -1.14 * R, 0.1 * R, 0.1 * R, p.cor2 || '#c62828', 3); },
  cowboy(ctx, R, p) { const c = p.cor || '#8a5a2e'; ctx.save(); ctx.beginPath(); ctx.moveTo(-1.35 * R, -0.86 * R); ctx.quadraticCurveTo(-1.2 * R, -0.52 * R, 0, -0.56 * R); ctx.quadraticCurveTo(1.2 * R, -0.52 * R, 1.35 * R, -0.86 * R); ctx.quadraticCurveTo(1.1 * R, -0.68 * R, 0, -0.72 * R); ctx.quadraticCurveTo(-1.1 * R, -0.68 * R, -1.35 * R, -0.86 * R); ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    shape(ctx, [[-0.62 * R, -0.7 * R], [0.62 * R, -0.7 * R], [0.55 * R, -1.16 * R], [0.18 * R, -1.24 * R], [0, -1.12 * R], [-0.18 * R, -1.24 * R], [-0.55 * R, -1.16 * R]], shade(c, 1.12), 5);
    ctx.fillStyle = p.cor2 || '#3a2312'; ctx.fillRect(-0.6 * R, -0.84 * R, 1.2 * R, 0.12 * R); },
  sombrero(ctx, R, p) { const c = p.cor || '#d9b56a'; ell(ctx, 0, -0.62 * R, 1.75 * R, 0.3 * R, c, 5); shape(ctx, [[-0.6 * R, -0.66 * R], [0.6 * R, -0.66 * R], [0.3 * R, -1.42 * R], [-0.3 * R, -1.42 * R]], shade(c, 1.08), 5);
    ctx.fillStyle = p.cor2 || '#c62828'; ctx.fillRect(-0.55 * R, -0.86 * R, 1.1 * R, 0.13 * R); ctx.strokeStyle = shade(c, 0.7); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -0.62 * R, 1.5 * R, 0.22 * R, 0, 0, TAU); ctx.stroke(); },
  cartola(ctx, R, p) { const c = p.cor || '#1b1b1b'; ell(ctx, 0, -0.66 * R, 0.95 * R, 0.17 * R, c, 5); shape(ctx, [[-0.6 * R, -0.68 * R], [0.6 * R, -0.68 * R], [0.64 * R, -1.62 * R], [-0.64 * R, -1.62 * R]], c, 5);
    ell(ctx, 0, -1.62 * R, 0.64 * R, 0.12 * R, shade(c, 1.4), 4); ctx.fillStyle = p.cor2 || '#5b2333'; ctx.fillRect(-0.6 * R, -0.86 * R, 1.2 * R, 0.14 * R); },
  coco(ctx, R, p) { const c = p.cor || '#1b1b1b'; ell(ctx, 0, -0.68 * R, 0.92 * R, 0.17 * R, c, 5); halfDome(ctx, -0.7 * R, 0.66 * R, 0.6 * R, c); ctx.fillStyle = shade(c, 1.5); ctx.fillRect(-0.64 * R, -0.84 * R, 1.28 * R, 0.1 * R); },
  tricorne(ctx, R, p) { const c = p.cor || '#1b1b1b'; ctx.save(); ctx.beginPath(); ctx.moveTo(-1.15 * R, -0.95 * R); ctx.quadraticCurveTo(-0.6 * R, -0.5 * R, 0, -0.42 * R); ctx.quadraticCurveTo(0.6 * R, -0.5 * R, 1.15 * R, -0.95 * R); ctx.quadraticCurveTo(0.5 * R, -1.42 * R, 0, -1.26 * R); ctx.quadraticCurveTo(-0.5 * R, -1.42 * R, -1.15 * R, -0.95 * R); ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); if (p.cor2) { ctx.strokeStyle = p.cor2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-1.08 * R, -0.95 * R); ctx.quadraticCurveTo(-0.6 * R, -0.56 * R, 0, -0.5 * R); ctx.quadraticCurveTo(0.6 * R, -0.56 * R, 1.08 * R, -0.95 * R); ctx.stroke(); } ctx.restore();
    if (p.estilo === 'pirata') { ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(0, -0.92 * R, 0.13 * R, 0, TAU); ctx.fill(); ctx.fillRect(-0.07 * R, -0.84 * R, 0.14 * R, 0.08 * R);
      ctx.strokeStyle = WHITE; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-0.22 * R, -0.66 * R); ctx.lineTo(0.22 * R, -0.8 * R); ctx.moveTo(0.22 * R, -0.66 * R); ctx.lineTo(-0.22 * R, -0.8 * R); ctx.stroke(); } },
  bicorne(ctx, R, p) { ctx.save(); ctx.beginPath(); ctx.moveTo(-1.0 * R, -0.6 * R); ctx.quadraticCurveTo(0, -1.55 * R, 1.0 * R, -0.6 * R); ctx.quadraticCurveTo(0, -0.86 * R, -1.0 * R, -0.6 * R); ctx.closePath();
    ctx.fillStyle = p.cor || '#161616'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); ell(ctx, 0.28 * R, -0.98 * R, 0.14 * R, 0.14 * R, p.cor2 || '#1f9e48', 3); },
  quepe(ctx, R, p) { const c = p.cor || '#44533f'; shape(ctx, [[-0.56 * R, -0.62 * R], [0.56 * R, -0.62 * R], [0.48 * R, -1.12 * R], [-0.48 * R, -1.12 * R]], c, 5);
    ctx.fillStyle = p.cor2 || '#b3202a'; ctx.fillRect(-0.54 * R, -0.76 * R, 1.08 * R, 0.12 * R); ell(ctx, 0, -0.6 * R, 0.64 * R, 0.12 * R, '#111', 4); },
  shako(ctx, R, p) { const c = p.cor || '#1b1b1b'; shape(ctx, [[-0.52 * R, -0.6 * R], [0.52 * R, -0.6 * R], [0.62 * R, -1.42 * R], [-0.62 * R, -1.42 * R]], c, 5); ell(ctx, 0, -0.6 * R, 0.62 * R, 0.12 * R, '#111', 4);
    ctx.fillStyle = GOLD; ctx.fillRect(-0.55 * R, -0.8 * R, 1.1 * R, 0.08 * R); ell(ctx, 0, -1.1 * R, 0.14 * R, 0.14 * R, GOLD, 3); ell(ctx, 0, -1.62 * R, 0.12 * R, 0.24 * R, p.cor2 || '#c62828', 3); },
  capacete_colonial(ctx, R, p) { const c = p.cor || '#e8dcc0'; ell(ctx, 0, -0.6 * R, 1.25 * R, 0.24 * R, c, 5); halfDome(ctx, -0.64 * R, 0.82 * R, 0.66 * R, shade(c, 1.04)); ctx.fillStyle = p.cor2 || '#8a6e4a'; ctx.fillRect(-0.8 * R, -0.8 * R, 1.6 * R, 0.1 * R); ell(ctx, 0, -1.3 * R, 0.08 * R, 0.06 * R, c, 3); },
  boina(ctx, R, p) { ell(ctx, 0.1 * R, -0.82 * R, 0.95 * R, 0.3 * R, p.cor || '#1f3a68', 5, -8 * D2R); if (p.cor2) ell(ctx, 0.14 * R, -1.1 * R, 0.13 * R, 0.13 * R, p.cor2, 3); },
  fez(ctx, R, p) { shape(ctx, [[-0.5 * R, -0.62 * R], [0.5 * R, -0.62 * R], [0.38 * R, -1.22 * R], [-0.38 * R, -1.22 * R]], p.cor || '#b3202a', 5); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -1.22 * R); ctx.quadraticCurveTo(0.5 * R, -1.15 * R, 0.5 * R, -0.8 * R); ctx.stroke(); },
  gorro_frigio(ctx, R, p) { ctx.save(); ctx.beginPath(); ctx.moveTo(-0.92 * R, -0.5 * R); ctx.quadraticCurveTo(-0.9 * R, -1.35 * R, 0.2 * R, -1.25 * R); ctx.quadraticCurveTo(0.75 * R, -1.2 * R, 0.62 * R, -0.85 * R); ctx.quadraticCurveTo(0.95 * R, -0.8 * R, 0.92 * R, -0.5 * R); ctx.quadraticCurveTo(0, -0.66 * R, -0.92 * R, -0.5 * R); ctx.closePath();
    ctx.fillStyle = p.cor || '#c62828'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); ell(ctx, -0.5 * R, -0.66 * R, 0.13 * R, 0.13 * R, '#1f3a68', 2); ell(ctx, -0.5 * R, -0.66 * R, 0.08 * R, 0.08 * R, WHITE, 0); ell(ctx, -0.5 * R, -0.66 * R, 0.035 * R, 0.035 * R, '#c62828', 0); },
  gorro_pele(ctx, R, p) { const c = p.cor || '#7a5230'; halfDome(ctx, -0.54 * R, 0.96 * R, 0.62 * R, c); ctx.strokeStyle = shade(c, 1.35); ctx.lineWidth = 2.5; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 0.2 * R, -0.62 * R); ctx.lineTo(i * 0.2 * R + 0.06 * R, -0.9 * R); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.moveTo(0.82 * R, -0.7 * R); ctx.quadraticCurveTo(1.35 * R, -0.3 * R, 1.15 * R, 0.5 * R); ctx.quadraticCurveTo(0.95 * R, 0.0, 0.72 * R, -0.52 * R); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.clip();
    ctx.fillStyle = '#2a1a0e'; for (let k = 0; k < 4; k++) ctx.fillRect(0.6 * R, -0.42 * R + k * 0.26 * R, 0.9 * R, 0.1 * R); ctx.restore(); },
  ushanka(ctx, R, p) { const c = p.cor || '#6b4a2b'; halfDome(ctx, -0.56 * R, 0.95 * R, 0.58 * R, shade(c, 0.85)); for (const sd of [-1, 1]) ell(ctx, sd * 0.92 * R, -0.1 * R, 0.26 * R, 0.5 * R, c, 4);
    ctx.save(); rr(ctx, -1.02 * R, -0.78 * R, 2.04 * R, 0.3 * R, 0.14 * R); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); if (p.cor2) { ctx.fillStyle = p.cor2; star(ctx, 0, -0.64 * R, 0.12 * R); } },
  mongol(ctx, R, p) { halfDome(ctx, -0.56 * R, 0.86 * R, 0.8 * R, p.cor || '#c62828'); ctx.save(); rr(ctx, -1.0 * R, -0.72 * R, 2.0 * R, 0.26 * R, 0.12 * R); ctx.fillStyle = '#7a5230'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); ell(ctx, 0, -1.38 * R, 0.08 * R, 0.08 * R, GOLD, 3); },
  capacete_astronauta(ctx, R) { ctx.save(); ctx.beginPath(); ctx.arc(0, -0.05 * R, 1.3 * R, 0, TAU); ctx.fillStyle = 'rgba(190,225,255,0.22)'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, -0.05 * R, 1.1 * R, 1.15 * Math.PI, 1.45 * Math.PI); ctx.stroke(); ctx.restore(); ell(ctx, 0, 1.22 * R, 0.9 * R, 0.2 * R, '#d3d8df', 5); },
  chef(ctx, R) { shape(ctx, [[-0.62 * R, -0.62 * R], [0.62 * R, -0.62 * R], [0.62 * R, -0.95 * R], [-0.62 * R, -0.95 * R]], WHITE, 5);
    for (const [x, y, r] of [[-0.5, -1.2, 0.36], [0, -1.38, 0.42], [0.5, -1.2, 0.36]]) ell(ctx, x * R, y * R, r * R, r * R, WHITE, 5); ctx.fillStyle = WHITE; ctx.fillRect(-0.58 * R, -1.08 * R, 1.16 * R, 0.2 * R); },
  capelo(ctx, R, p) { halfDome(ctx, -0.64 * R, 0.7 * R, 0.4 * R, p.cor || '#1b1b1b'); shape(ctx, [[-1.05 * R, -0.98 * R], [0, -1.22 * R], [1.05 * R, -0.98 * R], [0, -0.78 * R]], p.cor || '#1b1b1b', 5);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -1.0 * R); ctx.lineTo(0.8 * R, -0.92 * R); ctx.lineTo(0.84 * R, -0.5 * R); ctx.stroke(); ell(ctx, 0.84 * R, -0.46 * R, 0.06 * R, 0.1 * R, GOLD, 2); },
  capacete_obra(ctx, R, p) { const c = p.cor || '#f6c21a'; ell(ctx, 0, -0.6 * R, 1.08 * R, 0.16 * R, c, 5); halfDome(ctx, -0.62 * R, 0.86 * R, 0.62 * R, c); ctx.fillStyle = shade(c, 0.85); ctx.fillRect(-0.1 * R, -1.22 * R, 0.2 * R, 0.6 * R); },
  bandana_pirata(ctx, R, p) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.5 * R, 1.0 * R, 0.62 * R, 0, Math.PI * 0.98, Math.PI * 2.02); ctx.closePath(); ctx.fillStyle = p.cor || '#c62828'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    dots(ctx, [-0.5 * R, 0, 0.5 * R], -0.8 * R, 1, 0, WHITE, 0.06 * R); shape(ctx, [[0.9 * R, -0.5 * R], [1.35 * R, -0.25 * R], [1.2 * R, 0.0]], p.cor || '#c62828', 4); },
  elmo_cavaleiro(ctx, R, p) { const m = p.cor || METAL; halfDome(ctx, -0.36 * R, 1.02 * R, 0.76 * R, m); for (const sd of [-1, 1]) shape(ctx, [[sd * 1.0 * R, -0.36 * R], [sd * 0.74 * R, -0.36 * R], [sd * 0.8 * R, 0.62 * R], [sd * 1.0 * R, 0.5 * R]], m, 4);
    shape(ctx, [[-0.8 * R, -0.4 * R], [0.8 * R, -0.4 * R], [0.7 * R, -0.62 * R], [-0.7 * R, -0.62 * R]], shade(m, 0.85), 4); if (p.cor2) ell(ctx, 0, -1.26 * R, 0.16 * R, 0.32 * R, p.cor2, 4); },
  morion(ctx, R, p) { const m = p.cor || METAL; ctx.save(); ctx.beginPath(); ctx.moveTo(-1.35 * R, -0.95 * R); ctx.quadraticCurveTo(-0.8 * R, -0.5 * R, 0, -0.56 * R); ctx.quadraticCurveTo(0.8 * R, -0.5 * R, 1.35 * R, -0.95 * R); ctx.quadraticCurveTo(0.8 * R, -0.66 * R, 0, -0.68 * R); ctx.quadraticCurveTo(-0.8 * R, -0.66 * R, -1.35 * R, -0.95 * R); ctx.closePath();
    ctx.fillStyle = m; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); halfDome(ctx, -0.66 * R, 0.7 * R, 0.55 * R, m); shape(ctx, [[-0.1 * R, -1.2 * R], [0.1 * R, -1.2 * R], [0.06 * R, -0.68 * R], [-0.06 * R, -0.68 * R]], shade(m, 0.85), 3); },
  touca(ctx, R, p) { const c = p.cor || '#5b2c6f'; ctx.save(); ctx.beginPath(); ctx.arc(0, -0.08 * R, 1.16 * R, Math.PI * 0.82, Math.PI * 2.18); ctx.arc(0, -0.02 * R, 0.96 * R, Math.PI * 2.14, Math.PI * 0.86, true); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    const c2 = p.cor2 || '#e8d3ff'; wline(ctx, [[-0.9 * R, 0.5 * R], [0, 1.02 * R], [0.9 * R, 0.5 * R]], c2, 6); ell(ctx, -0.08 * R, 1.04 * R, 0.12 * R, 0.08 * R, c2, 3); ell(ctx, 0.08 * R, 1.04 * R, 0.12 * R, 0.08 * R, c2, 3); },
  peruca_colonial(ctx, R, p) { const c = p.cor || '#f1f1f1'; halfDome(ctx, -0.46 * R, 0.98 * R, 0.62 * R, c, 4); for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) ell(ctx, sd * 0.92 * R, -0.24 * R + k * 0.26 * R, 0.16 * R, 0.13 * R, c, 3.5); },
  pele_urso(ctx, R, p) { const c = p.cor || '#151515'; ctx.save(); rr(ctx, -0.82 * R, -2.0 * R, 1.64 * R, 1.55 * R, 0.6 * R); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.clip();
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; for (let i = 0; i < 26; i++) { const x = -0.8 * R + hash(i) * 1.6 * R, y = -1.95 * R + hash(i + 40) * 1.4 * R; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 12); ctx.stroke(); } ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-0.82 * R, -0.5 * R); ctx.quadraticCurveTo(-0.6 * R, 0.95 * R, 0, 0.98 * R); ctx.quadraticCurveTo(0.6 * R, 0.95 * R, 0.82 * R, -0.5 * R); ctx.stroke(); },
  capacete_ww1(ctx, R, p) { const c = p.cor || '#6b6b4a'; ell(ctx, 0, -0.58 * R, 1.32 * R, 0.22 * R, c, 5); halfDome(ctx, -0.6 * R, 0.8 * R, 0.5 * R, shade(c, 1.05)); },
  capacete_ww2(ctx, R, p) { const c = p.cor || '#5e6b3a'; halfDome(ctx, -0.36 * R, 1.06 * R, 0.82 * R, c); ell(ctx, 0, -0.38 * R, 1.08 * R, 0.1 * R, shade(c, 0.85), 4);
    ctx.strokeStyle = '#3a3a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-0.92 * R, -0.3 * R); ctx.quadraticCurveTo(-0.7 * R, 0.9 * R, 0, 0.95 * R); ctx.stroke(); },
  bone(ctx, R, p) { const c = p.cor || '#c62828'; halfDome(ctx, -0.52 * R, 0.96 * R, 0.6 * R, c); ell(ctx, 0.0, -0.52 * R, 0.62 * R, 0.13 * R, shade(c, 0.8), 4); ell(ctx, 0, -1.1 * R, 0.07 * R, 0.05 * R, c, 2); },
  fita(ctx, R, p) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.5 * R, 0.97 * R, 0.16 * R, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.lineWidth = 0.14 * R; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 0.09 * R; ctx.strokeStyle = p.cor || '#c62828'; ctx.stroke(); ctx.restore(); },
  capuz_ninja(ctx, R, p) { const c = p.cor || '#1b1b1b'; ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * 1.04, 0, TAU); ctx.rect(-0.9 * R, -0.24 * R, 1.8 * R, 0.34 * R); ctx.fillStyle = c; ctx.fill('evenodd'); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    shape(ctx, [[0.9 * R, -0.3 * R], [1.45 * R, -0.5 * R], [1.35 * R, -0.18 * R]], c, 4); },
  capuz_monge(ctx, R, p) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0.05 * R, 1.16 * R, Math.PI * 0.72, Math.PI * 2.28); ctx.arc(0, 0.05 * R, 1.0 * R, Math.PI * 2.24, Math.PI * 0.76, true); ctx.closePath(); ctx.fillStyle = p.cor || '#6b4a2b'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); },
  bobo(ctx, R, p) { const cs = [p.cor || '#c62828', p.cor2 || GOLD, p.cor || '#c62828']; [-1, 0, 1].forEach((k, i) => { ctx.save(); ctx.beginPath(); ctx.moveTo(-0.5 * R + k * 0.3 * R, -0.62 * R); ctx.quadraticCurveTo(k * 1.1 * R, -1.6 * R, k * 1.25 * R + (k === 0 ? 0.2 * R : 0), -1.0 * R - (k === 0 ? 0.6 * R : 0));
    ctx.quadraticCurveTo(k * 0.6 * R, -1.0 * R, 0.5 * R + k * 0.3 * R, -0.62 * R); ctx.closePath(); ctx.fillStyle = cs[i]; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    ell(ctx, k * 1.25 * R + (k === 0 ? 0.2 * R : 0), -1.0 * R - (k === 0 ? 0.6 * R : 0), 0.1 * R, 0.1 * R, GOLD, 3); });
    ctx.save(); rr(ctx, -0.95 * R, -0.74 * R, 1.9 * R, 0.2 * R, 0.08 * R); ctx.fillStyle = cs[1]; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); },
  eboshi(ctx, R, p) { shape(ctx, [[-0.45 * R, -0.66 * R], [0.45 * R, -0.66 * R], [0.35 * R, -1.6 * R], [-0.05 * R, -1.75 * R], [-0.35 * R, -1.5 * R]], p.cor || '#1b1b1b', 5); },
  topi(ctx, R, p) { shape(ctx, [[-0.7 * R, -0.62 * R], [0.7 * R, -0.62 * R], [0.58 * R, -0.98 * R], [0, -1.08 * R], [-0.58 * R, -0.98 * R]], p.cor || WHITE, 5); },
  deerstalker(ctx, R, p) { const c = p.cor || '#8a7a5a'; halfDome(ctx, -0.56 * R, 0.92 * R, 0.66 * R, c); ell(ctx, 0, -0.54 * R, 0.64 * R, 0.12 * R, shade(c, 0.8), 4); for (const sd of [-1, 1]) ell(ctx, sd * 0.84 * R, -0.42 * R, 0.16 * R, 0.24 * R, c, 4);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.86 * R, 0.9 * R, 0.5 * R, 0, Math.PI, 0); ctx.clip(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#4a3a2a'; for (let x = -1; x < 1; x += 0.22) ctx.fillRect(x * R, -1.4 * R, 0.07 * R, R); ctx.restore(); },
  gorro_noel(ctx, R, p) { ctx.save(); ctx.beginPath(); ctx.moveTo(-0.9 * R, -0.58 * R); ctx.quadraticCurveTo(-0.6 * R, -1.45 * R, 0.35 * R, -1.3 * R); ctx.quadraticCurveTo(1.1 * R, -1.15 * R, 1.15 * R, -0.45 * R);
    ctx.quadraticCurveTo(0.95 * R, -0.95 * R, 0.6 * R, -0.95 * R); ctx.quadraticCurveTo(0.9 * R, -0.8 * R, 0.9 * R, -0.58 * R); ctx.closePath(); ctx.fillStyle = p.cor || '#c62828'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    ctx.save(); rr(ctx, -1.0 * R, -0.74 * R, 2.0 * R, 0.26 * R, 0.13 * R); ctx.fillStyle = WHITE; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); ell(ctx, 1.15 * R, -0.42 * R, 0.16 * R, 0.16 * R, WHITE, 4); },
  mitra(ctx, R, p) { shape(ctx, [[-0.6 * R, -0.62 * R], [0.6 * R, -0.62 * R], [0.62 * R, -1.25 * R], [0, -1.75 * R], [-0.62 * R, -1.25 * R]], p.cor || WHITE, 5);
    ctx.fillStyle = p.cor2 || GOLD; ctx.fillRect(-0.08 * R, -1.62 * R, 0.16 * R, 1.0 * R); ctx.fillRect(-0.6 * R, -0.8 * R, 1.2 * R, 0.14 * R); },
  capotain(ctx, R, p) { const c = p.cor || '#1b1b1b'; ell(ctx, 0, -0.66 * R, 1.0 * R, 0.17 * R, c, 5); shape(ctx, [[-0.58 * R, -0.68 * R], [0.58 * R, -0.68 * R], [0.48 * R, -1.6 * R], [-0.48 * R, -1.6 * R]], c, 5);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-0.56 * R, -0.88 * R, 1.12 * R, 0.16 * R); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.strokeRect(-0.16 * R, -0.9 * R, 0.32 * R, 0.2 * R); },
  cocar_asteca(ctx, R, p) { ctx.save(); rr(ctx, -0.98 * R, -0.74 * R, 1.96 * R, 0.24 * R, 0.1 * R); ctx.fillStyle = p.cor2 || GOLD; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    ell(ctx, 0, -0.62 * R, 0.12 * R, 0.12 * R, '#1fa2a8', 3); },
  peruca_alta(ctx, R, p) { const c = p.cor || '#f1f1f1'; ctx.save(); ctx.beginPath(); ctx.moveTo(-0.95 * R, -0.3 * R); ctx.quadraticCurveTo(-1.15 * R, -1.6 * R, -0.3 * R, -2.1 * R); ctx.quadraticCurveTo(0.2 * R, -2.35 * R, 0.6 * R, -2.0 * R);
    ctx.quadraticCurveTo(1.2 * R, -1.5 * R, 0.95 * R, -0.3 * R); ctx.quadraticCurveTo(0, -0.75 * R, -0.95 * R, -0.3 * R); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
    ctx.strokeStyle = shade(c, 0.8); ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-0.2 * R + i * 0.15 * R, -1.3 * R - i * 0.15 * R, 0.25 * R, 3.6, 5.6); ctx.stroke(); }
    ell(ctx, 0.5 * R, -1.85 * R, 0.16 * R, 0.1 * R, p.cor2 || '#f48fb1', 3); },
  chapeu_palha(ctx, R) { COSTUMES.colono.hat(ctx, R); },
  chapeu_explorador(ctx, R) { COSTUMES.capitao.hat(ctx, R); },
  chapeu_garimpeiro(ctx, R) { COSTUMES.garimpeiro.hat(ctx, R); },
  chapeu_pluma(ctx, R) { COSTUMES.nobre.hat(ctx, R); },
  fedora(ctx, R) { COSTUMES.presidente_fedora.hat(ctx, R); },
  cocar_tupi(ctx, R) { COSTUMES.tupi.hat(ctx, R); },
  cocar_carnaval(ctx, R) { COSTUMES.carnaval.hat(ctx, R); },
};
const HAT_BACK = { cocar_tupi: COSTUMES.tupi.hatBack, cocar_carnaval: COSTUMES.carnaval.hatBack,
  cocar_asteca(ctx, R, p) { featherFan(ctx, R, 11, 120, 0.55 * R, 1.25 * R, [p.cor || '#2e9d5a', '#1fa2a8', p.cor || '#2e9d5a', GOLD], -0.45 * R); },
  capuz_monge(ctx, R, p) { ell(ctx, 0, 0.1 * R, 1.25 * R, 1.25 * R, p.cor || '#6b4a2b', 5); },
  capuz_ninja(ctx, R, p) { ell(ctx, 0, 0, 1.08 * R, 1.08 * R, p.cor || '#1b1b1b', 5); },
  kabuto(ctx, R, p) { shape(ctx, [[-1.0 * R, -0.3 * R], [1.0 * R, -0.3 * R], [1.45 * R, 0.5 * R], [-1.45 * R, 0.5 * R]], p.cor || '#1b1b1b', 5);
    ctx.strokeStyle = '#c62828'; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-1.1 * R - k * 0.12 * R, -0.05 * R + k * 0.18 * R); ctx.lineTo(1.1 * R + k * 0.12 * R, -0.05 * R + k * 0.18 * R); ctx.stroke(); } },
  peruca_colonial(ctx, R, p) { ell(ctx, 0, -0.1 * R, 1.06 * R, 1.02 * R, p.cor || '#f1f1f1', 4); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0.9 * R); ctx.lineTo(0, 1.25 * R); ctx.stroke(); },
};
const HAT_NAMES = Object.keys(HAT);

/* ---------- monta um figurino a partir das peças ---------- */
function makeCostume(spec) {
  const asArr = v => (Array.isArray(v) ? v : v ? [v] : []);
  const tr = spec.tronco || { tipo: 'liso', cor: '#f2f2f2' }, fr = asArr(spec.frente), lo = spec.baixo, bk = spec.costas, hat = spec.chapeu, face = asArr(spec.rosto);
  const hair = face.find(f => f.tipo === 'cabelo'), faceParts = face.filter(f => f.tipo !== 'cabelo');
  const C = { armStyle: spec.bracos === 'branco' ? 'white' : 'black', boot: spec.bota || '#151515', sleeve: spec.manga === undefined ? (tr.tipo === 'sem_camisa' ? null : tr.cor || null) : spec.manga,
    torso(ctx, lift) { (TORSO[tr.tipo] || TORSO.liso)(ctx, RIG.torsoTop + lift, tr); } };
  if (bk && BACK[bk.tipo]) C.back = (ctx, lift) => BACK[bk.tipo](ctx, lift, bk);
  if (lo && LOWER[lo.tipo]) C.lower = ctx => LOWER[lo.tipo](ctx, lo);
  if (fr.length) C.front = (ctx, lift) => fr.forEach(f => FRONT[f.tipo] && FRONT[f.tipo](ctx, RIG.torsoTop + lift, f));
  const hb = hat && HAT_BACK[hat.tipo], hairStyle = hair && HAIR[hair.estilo || 'longo'];
  if (hb || hairStyle) C.hatBack = (ctx, R) => { if (hairStyle) hairStyle.back(ctx, R, hair.cor || '#3a2a1a'); if (hb) hb(ctx, R, hat); };
  if (faceParts.length || hairStyle) C.face = (ctx, R) => { faceParts.forEach(f => FACE[f.tipo] && FACE[f.tipo](ctx, R, f)); if (hairStyle && !hat) hairStyle.front(ctx, R, hair.cor || '#3a2a1a'); };
  if (hat && HAT[hat.tipo]) C.hat = (ctx, R) => { if (hairStyle) hairStyle.front(ctx, R, hair.cor || '#3a2a1a'); HAT[hat.tipo](ctx, R, hat); };
  C.spec = spec;
  return C;
}
function validateSpec(name, spec) {
  const w = [], ck = (part, table, label) => { if (part && part.tipo && !table[part.tipo]) w.push(`⚠ figurino "${name}": ${label} "${part.tipo}" não existe`); };
  ck(spec.tronco, TORSO, 'tronco'); ck(spec.baixo, LOWER, 'baixo'); ck(spec.costas, BACK, 'costas'); ck(spec.chapeu, HAT, 'chapeu');
  (Array.isArray(spec.frente) ? spec.frente : spec.frente ? [spec.frente] : []).forEach(f => ck(f, FRONT, 'frente'));
  (Array.isArray(spec.rosto) ? spec.rosto : spec.rosto ? [spec.rosto] : []).forEach(f => { if (f.tipo === 'cabelo') { if (f.estilo && !HAIR[f.estilo]) w.push(`⚠ figurino "${name}": cabelo "${f.estilo}" não existe`); } else ck(f, FACE, 'rosto'); });
  return w;
}

/* ---------- PRESETS: figurinos prontos (épocas e nacionalidades) ---------- */
const PRESETS = {
  // pré-história e antiguidade
  homem_das_cavernas: { tronco: { tipo: 'pele', cor: '#8a5a2e' }, baixo: { tipo: 'saia_curta', cor: '#7a4f27' }, rosto: [{ tipo: 'barba', estilo: 'cheia', cor: '#4a3020' }], manga: null },
  farao: { tronco: { tipo: 'sem_camisa' }, frente: [{ tipo: 'colar_egipcio' }], baixo: { tipo: 'shendyt' }, chapeu: { tipo: 'nemes' }, manga: null },
  egipcio: { tronco: { tipo: 'sem_camisa' }, frente: [{ tipo: 'colar_egipcio', cores: ['#1fa2a8', GOLD] }], baixo: { tipo: 'shendyt', cor2: '#e8dcc0' }, rosto: [{ tipo: 'cabelo', estilo: 'chanel', cor: '#1b1b1b' }], manga: null },
  rainha_egipcia: { tronco: { tipo: 'liso', cor: WHITE }, frente: [{ tipo: 'colar_egipcio' }], baixo: { tipo: 'vestido', cor: WHITE, cor2: GOLD }, chapeu: { tipo: 'tiara' }, rosto: [{ tipo: 'cabelo', estilo: 'chanel', cor: '#1b1b1b' }] },
  hoplita: { tronco: { tipo: 'liso', cor: '#efe6d0' }, frente: [{ tipo: 'peitoral', cor: BRONZE }], baixo: { tipo: 'saia_curta', cor: '#b3202a' }, chapeu: { tipo: 'elmo_grego' } },
  espartano: { tronco: { tipo: 'sem_camisa' }, frente: [{ tipo: 'peitoral', cor: BRONZE }], baixo: { tipo: 'saia_curta', cor: '#8a1f2a' }, costas: { tipo: 'capa', cor: '#a3192a' }, chapeu: { tipo: 'elmo_grego' }, manga: null },
  filosofo: { tronco: { tipo: 'toga', cor: WHITE }, baixo: { tipo: 'manto_longo', cor: WHITE }, rosto: [{ tipo: 'barba', estilo: 'longa' }] },
  legionario: { tronco: { tipo: 'armadura' }, baixo: { tipo: 'saia_curta', cor: '#b3202a' }, chapeu: { tipo: 'elmo_romano' }, frente: [{ tipo: 'cinto', cor: '#5b3a1d' }], manga: '#b3202a' },
  centuriao: { tronco: { tipo: 'armadura' }, baixo: { tipo: 'saia_curta', cor: '#b3202a' }, costas: { tipo: 'capa_curta', cor: '#a3192a' }, chapeu: { tipo: 'elmo_romano', estilo: 'centuriao' }, manga: '#b3202a' },
  senador: { tronco: { tipo: 'toga', cor: WHITE, cor2: '#6b1f7a' }, baixo: { tipo: 'manto_longo', cor: WHITE } },
  imperador_romano: { tronco: { tipo: 'toga', cor: '#6b1f7a', cor2: GOLD }, baixo: { tipo: 'manto_longo', cor: '#6b1f7a', cor2: GOLD }, chapeu: { tipo: 'louros', cor: GOLD } },
  gladiador: { tronco: { tipo: 'sem_camisa' }, frente: [{ tipo: 'cinto', cor: '#7a5230' }, { tipo: 'ombreiras' }], baixo: { tipo: 'saia_curta', cor: '#8a5a2e' }, chapeu: { tipo: 'elmo_romano', estilo: 'gladiador' }, manga: null },
  // idade média
  viking: { tronco: { tipo: 'liso', cor: '#6b4a2b' }, frente: [{ tipo: 'cinto' }], costas: { tipo: 'capa_curta', cor: '#7d8a5a', borda: 'pele' }, baixo: { tipo: 'saia_curta', cor: '#5b3a1d' }, chapeu: { tipo: 'elmo_viking' }, rosto: [{ tipo: 'barba', estilo: 'cheia', cor: '#c8642a' }] },
  viking_mito: { tronco: { tipo: 'liso', cor: '#6b4a2b' }, frente: [{ tipo: 'cinto' }], costas: { tipo: 'capa_curta', cor: '#7d8a5a', borda: 'pele' }, baixo: { tipo: 'saia_curta', cor: '#5b3a1d' }, chapeu: { tipo: 'elmo_viking', estilo: 'chifres' }, rosto: [{ tipo: 'barba', estilo: 'cheia', cor: '#c8642a' }] },
  cavaleiro: { tronco: { tipo: 'tabardo', cor: '#1f4fa3', cor2: GOLD, emblema: 'chevron' }, frente: [{ tipo: 'ombreiras' }], chapeu: { tipo: 'elmo_cavaleiro', cor2: '#c62828' }, manga: '#9aa1a8' },
  cruzado: { tronco: { tipo: 'tabardo', cor: WHITE, cor2: '#c62828', emblema: 'cruz' }, chapeu: { tipo: 'elmo_cavaleiro' }, manga: '#9aa1a8' },
  rainha: { costas: { tipo: 'capa', cor: '#6b1f7a', borda: 'arminho' }, tronco: { tipo: 'liso', cor: '#6b1f7a' }, frente: [{ tipo: 'perolas' }], baixo: { tipo: 'vestido', cor: '#6b1f7a', cor2: GOLD }, chapeu: { tipo: 'coroa' }, rosto: [{ tipo: 'cabelo', estilo: 'longo', cor: '#c8a24a' }] },
  campones: { tronco: { tipo: 'liso', cor: '#a68a64' }, frente: [{ tipo: 'cinto', cor: '#c9a15a', cor2: '#c9a15a' }], baixo: { tipo: 'saia_curta', cor: '#8a6e4a' }, chapeu: { tipo: 'chapeu_palha' } },
  monge: { tronco: { tipo: 'liso', cor: '#6b4a2b' }, baixo: { tipo: 'manto_longo', cor: '#6b4a2b' }, frente: [{ tipo: 'cinto', cor: '#c9a15a', cor2: '#c9a15a' }], chapeu: { tipo: 'capuz_monge' } },
  bobo_da_corte: { tronco: { tipo: 'arlequim' }, chapeu: { tipo: 'bobo' }, manga: GOLD },
  // ásia
  samurai: { tronco: { tipo: 'listras_h', cor: '#b3202a', cor2: '#1b1b1b' }, frente: [{ tipo: 'ombreiras', cor: '#1b1b1b' }], baixo: { tipo: 'hakama', cor: '#2b2b3a' }, chapeu: { tipo: 'kabuto', cor: '#b3202a' } },
  ninja: { tronco: { tipo: 'liso', cor: '#1b1b1b' }, frente: [{ tipo: 'cinto', cor: '#3a3a3a', cor2: '#3a3a3a' }], chapeu: { tipo: 'capuz_ninja' } },
  shogun: { tronco: { tipo: 'kimono', cor: '#2b3a67', cor2: WHITE, cor3: '#c9a15a' }, frente: [{ tipo: 'kamishimo', cor: '#2b3a67' }], baixo: { tipo: 'hakama', cor: '#2b3a67' }, chapeu: { tipo: 'eboshi' } },
  kimono: { tronco: { tipo: 'kimono', cor: '#c0392b', cor2: WHITE, cor3: GOLD }, baixo: { tipo: 'manto_longo', cor: '#c0392b' }, rosto: [{ tipo: 'cabelo', estilo: 'coque', cor: '#1b1b1b' }] },
  imperador_chines: { tronco: { tipo: 'kaftan', cor: '#f2c230', cor2: '#c62828' }, baixo: { tipo: 'manto_longo', cor: '#f2c230', cor2: '#c62828' }, chapeu: { tipo: 'mianguan' }, rosto: [{ tipo: 'bigode', estilo: 'fino', cor: '#1b1b1b' }] },
  mandarim: { tronco: { tipo: 'kaftan', cor: '#1f2a44', cor2: '#3a4a6a' }, frente: [{ tipo: 'emblema_quadrado' }], baixo: { tipo: 'manto_longo', cor: '#1f2a44' }, chapeu: { tipo: 'chapeu_qing' }, rosto: [{ tipo: 'bigode', estilo: 'fino', cor: '#1b1b1b' }] },
  soldado_terracota: { tronco: { tipo: 'armadura', cor: '#8a6a4a', cor2: '#6b4a2b' }, baixo: { tipo: 'saia_curta', cor: '#7a5a3a' }, rosto: [{ tipo: 'cabelo', estilo: 'coque', cor: '#3a2a1a' }], manga: '#7a5a3a' },
  mongol: { tronco: { tipo: 'kaftan', cor: '#1f4fa3', cor2: GOLD }, frente: [{ tipo: 'cinto', cor: '#c62828' }], chapeu: { tipo: 'mongol' }, rosto: [{ tipo: 'bigode', estilo: 'fino', cor: '#1b1b1b' }] },
  maraja: { tronco: { tipo: 'kaftan', cor: '#f4f1e6', cor2: GOLD }, frente: [{ tipo: 'perolas' }, { tipo: 'faixa', cor: '#1f6b3a' }], baixo: { tipo: 'manto_longo', cor: '#f4f1e6', cor2: GOLD }, chapeu: { tipo: 'turbante', cor: '#f2c230', estilo: 'maraja' }, rosto: [{ tipo: 'barba', estilo: 'cheia', cor: '#1b1b1b' }] },
  indiano: { tronco: { tipo: 'kaftan', cor: '#f4f1e6', cor2: '#c9a15a' }, baixo: { tipo: 'manto_longo', cor: '#f4f1e6' }, chapeu: { tipo: 'topi' } },
  // américas
  pai_fundador: { tronco: { tipo: 'uniforme', cor: '#2a3b6b', colunas: 1 }, frente: [{ tipo: 'gola_alta' }], chapeu: { tipo: 'tricorne' }, rosto: [{ tipo: 'cabelo', estilo: 'rabo', cor: '#f1f1f1' }] },
  casaca_vermelha: { tronco: { tipo: 'uniforme', cor: '#c0392b', colunas: 2 }, frente: [{ tipo: 'cinto_cruzado' }], chapeu: { tipo: 'tricorne', cor2: WHITE } },
  guarda_real: { tronco: { tipo: 'uniforme', cor: '#c0392b', colunas: 1 }, frente: [{ tipo: 'cinto', cor: WHITE, cor2: GOLD }], chapeu: { tipo: 'pele_urso' } },
  cowboy: { tronco: { tipo: 'colete', cor: '#e7dcc3', cor2: '#6b4a2b' }, frente: [{ tipo: 'bandana', cor: '#c0392b' }], chapeu: { tipo: 'cowboy' }, bota: '#5b3a1d' },
  xerife: { tronco: { tipo: 'colete', cor: '#d9cbb0', cor2: '#3a2a1a' }, frente: [{ tipo: 'estrela_xerife' }], chapeu: { tipo: 'cowboy', cor: '#3a2a1a', cor2: '#151515' }, rosto: [{ tipo: 'bigode', estilo: 'grande', cor: '#3a2a1a' }], bota: '#5b3a1d' },
  pioneiro: { tronco: { tipo: 'liso', cor: '#a67c52' }, frente: [{ tipo: 'franjas', cor: '#a67c52' }, { tipo: 'cinto' }], chapeu: { tipo: 'gorro_pele' }, bota: '#5b3a1d' },
  soldado_mexicano: { tronco: { tipo: 'uniforme', cor: '#1f3a68', colunas: 2, cor3: '#c62828' }, frente: [{ tipo: 'cinto_cruzado' }], chapeu: { tipo: 'shako' } },
  charro: { tronco: { tipo: 'uniforme', cor: '#1b1b1b', colunas: 2, cor2: '#d9dde3' }, frente: [{ tipo: 'gravata_borboleta', cor: '#c62828' }], chapeu: { tipo: 'sombrero', cor: '#1b1b1b', cor2: '#d9dde3' } },
  conquistador: { tronco: { tipo: 'liso', cor: '#8a1f2a' }, frente: [{ tipo: 'peitoral' }, { tipo: 'ombreiras' }], chapeu: { tipo: 'morion' }, rosto: [{ tipo: 'barba', estilo: 'cavanhaque', cor: '#3a2a1a' }] },
  soldado_uniao: { tronco: { tipo: 'uniforme', cor: '#1f2a5a', colunas: 1 }, frente: [{ tipo: 'cinto' }], chapeu: { tipo: 'quepe', cor: '#1f2a5a', cor2: '#1f2a5a' } },
  confederado: { tronco: { tipo: 'uniforme', cor: '#7d8088', colunas: 2 }, frente: [{ tipo: 'cinto' }], chapeu: { tipo: 'quepe', cor: '#7d8088', cor2: '#7d8088' } },
  // europa moderna
  napoleao: { tronco: { tipo: 'uniforme', cor: '#1d2b57', colunas: 2 }, frente: [{ tipo: 'dragonas' }, { tipo: 'gola_alta' }], chapeu: { tipo: 'bicorne', cor2: '#c62828' } },
  revolucionario: { tronco: { tipo: 'liso', cor: '#1f3a68' }, frente: [{ tipo: 'faixa', cor: '#c62828', cor2: WHITE }], chapeu: { tipo: 'gorro_frigio' } },
  cavalheiro_vitoriano: { tronco: { tipo: 'terno', cor: '#2b2b2b', cor2: '#5b2333' }, chapeu: { tipo: 'cartola' }, rosto: [{ tipo: 'bigode', estilo: 'guidao', cor: '#3a2a1a' }] },
  dama_vitoriana: { tronco: { tipo: 'liso', cor: '#5b2c6f' }, frente: [{ tipo: 'gola_alta', cor: '#e8d3ff' }], baixo: { tipo: 'vestido', cor: '#5b2c6f', cor2: '#e8d3ff' }, chapeu: { tipo: 'touca' } },
  rainha_vitoria: { tronco: { tipo: 'liso', cor: '#1b1b1b' }, frente: [{ tipo: 'faixa', cor: '#2f6fd6' }], baixo: { tipo: 'vestido', cor: '#1b1b1b', cor2: '#555' }, chapeu: { tipo: 'coroa', estilo: 'pequena' }, rosto: [{ tipo: 'cabelo', estilo: 'coque', cor: '#8a8a8a' }] },
  czar: { costas: { tipo: 'capa', cor: '#b3202a', borda: 'arminho' }, tronco: { tipo: 'uniforme', cor: '#2f5a3a', colunas: 2 }, frente: [{ tipo: 'faixa', cor: '#2f6fd6' }], chapeu: { tipo: 'coroa', estilo: 'fechada' }, rosto: [{ tipo: 'barba', estilo: 'cheia', cor: '#5a3a1a' }] },
  detetive: { tronco: { tipo: 'xadrez', cor: '#8a7a5a', cor2: '#4a3a2a' }, costas: { tipo: 'capa_curta', cor: '#8a7a5a' }, chapeu: { tipo: 'deerstalker' } },
  pirata: { tronco: { tipo: 'listras_h', cor: WHITE, cor2: '#c62828' }, frente: [{ tipo: 'cinto' }], chapeu: { tipo: 'tricorne', estilo: 'pirata' }, rosto: [{ tipo: 'tapa_olho' }, { tipo: 'barba', estilo: 'curta', cor: '#2a1a0e' }] },
  // datas comemorativas e religião (com respeito)
  papai_noel: { tronco: { tipo: 'liso', cor: '#c62828' }, frente: [{ tipo: 'pele_branca' }, { tipo: 'cinto', cor: '#151515', cor2: GOLD }], baixo: { tipo: 'saia_curta', cor: '#c62828' }, chapeu: { tipo: 'gorro_noel' }, rosto: [{ tipo: 'barba', estilo: 'longa' }] },
  bispo: { tronco: { tipo: 'liso', cor: '#c62828' }, frente: [{ tipo: 'faixa', cor: GOLD }], baixo: { tipo: 'manto_longo', cor: WHITE, cor2: GOLD }, chapeu: { tipo: 'mitra' }, rosto: [{ tipo: 'barba', estilo: 'longa' }] },
  puritano: { tronco: { tipo: 'liso', cor: '#1b1b1b' }, frente: [{ tipo: 'gola_puritana' }, { tipo: 'cinto', cor: '#3a2312', cor2: GOLD }], chapeu: { tipo: 'capotain' } },
  // mais nacionalidades
  asteca: { tronco: { tipo: 'liso', cor: '#f4f1e6' }, frente: [{ tipo: 'colar', cores: ['#1fa2a8', GOLD, '#c62828'] }], costas: { tipo: 'capa', cor: '#1fa2a8', borda: 'ouro' }, baixo: { tipo: 'saia_curta', cor: '#f4f1e6' }, chapeu: { tipo: 'cocar_asteca' } },
  revolucionario_mexicano: { tronco: { tipo: 'liso', cor: '#e8dcc0' }, frente: [{ tipo: 'cartucheira' }], chapeu: { tipo: 'sombrero', cor: '#c9a15a', cor2: '#6b4a2b' }, rosto: [{ tipo: 'bigode', estilo: 'grande', cor: '#1b1b1b' }] },
  cosmonauta: { tronco: { tipo: 'espacial', cor2: '#c62828' }, chapeu: { tipo: 'capacete_astronauta' }, bracos: 'branco', bota: '#eef1f5' },
  rei_frances: { costas: { tipo: 'capa', cor: '#1f3a8a', borda: 'arminho' }, tronco: { tipo: 'liso', cor: '#1f3a8a' }, frente: [{ tipo: 'arminho' }], chapeu: { tipo: 'coroa' }, rosto: [{ tipo: 'cabelo', estilo: 'longo', cor: '#3a2a1a' }] },
  maria_antonieta: { tronco: { tipo: 'liso', cor: '#f8bbd0' }, frente: [{ tipo: 'perolas' }], baixo: { tipo: 'vestido', cor: '#f8bbd0', cor2: WHITE }, chapeu: { tipo: 'peruca_alta' } },
  atleta_grego: { tronco: { tipo: 'sem_camisa' }, baixo: { tipo: 'saia_curta', cor: WHITE }, chapeu: { tipo: 'louros' }, manga: null },
  russo: { tronco: { tipo: 'kaftan', cor: '#6b2a2a', cor2: '#1b1b1b' }, frente: [{ tipo: 'cinto' }], chapeu: { tipo: 'ushanka' }, rosto: [{ tipo: 'barba', estilo: 'cheia', cor: '#5a3a1a' }] },
  // personagens históricos do plano de 20 episódios
  godo: { tronco: { tipo: 'pele', cor: '#7a5a3a' }, baixo: { tipo: 'saia_curta', cor: '#5b4a2a' }, costas: { tipo: 'capa_curta', cor: '#4a5a3a', borda: 'pele' }, rosto: [{ tipo: 'cabelo', estilo: 'longo', cor: '#8a5a2a' }, { tipo: 'barba', estilo: 'cheia', cor: '#8a5a2a' }] },
  gaules: { tronco: { tipo: 'listras_v', cor: '#2e6b3a', cor2: '#c9a15a' }, frente: [{ tipo: 'cinto' }], rosto: [{ tipo: 'cabelo', estilo: 'longo', cor: '#c8642a' }, { tipo: 'bigode', estilo: 'guidao', cor: '#c8642a' }] },
  joana_darc: { tronco: { tipo: 'armadura', cor2: '#1f3a8a' }, frente: [{ tipo: 'ombreiras' }], rosto: [{ tipo: 'cabelo', estilo: 'chanel', cor: '#5a3a1a' }], manga: '#9aa1a8' },
  alexandre: { tronco: { tipo: 'armadura', cor: '#d9b44a', cor2: '#b3202a' }, costas: { tipo: 'capa', cor: '#b3202a' }, baixo: { tipo: 'saia_curta', cor: '#b3202a' }, chapeu: { tipo: 'elmo_grego' } },
  czar_sem_barba: { costas: { tipo: 'capa', cor: '#b3202a', borda: 'arminho' }, tronco: { tipo: 'uniforme', cor: '#2f5a3a', colunas: 2 }, chapeu: { tipo: 'coroa', estilo: 'fechada' }, rosto: [{ tipo: 'bigode', estilo: 'fino', cor: '#3a2a1a' }] },
  barba_negra: { tronco: { tipo: 'colete', cor: '#e8dcc0', cor2: '#1b1b1b' }, frente: [{ tipo: 'cinto_cruzado', cor: '#3a2312' }], chapeu: { tipo: 'tricorne', estilo: 'pirata' }, rosto: [{ tipo: 'barba', estilo: 'cheia', cor: '#1b1b1b' }] },
  jogador_criquete: { tronco: { tipo: 'liso', cor: '#f4f1e6' }, frente: [{ tipo: 'botoes' }], chapeu: { tipo: 'bone', cor: '#1f4fa3' } },
  rainha_margherita: { tronco: { tipo: 'liso', cor: '#f4f1e6' }, frente: [{ tipo: 'perolas' }], baixo: { tipo: 'vestido', cor: '#f4f1e6', cor2: '#c62828' }, chapeu: { tipo: 'tiara' }, rosto: [{ tipo: 'cabelo', estilo: 'coque', cor: '#c8a24a' }] },
  // século XX e hoje
  soldado_ww1: { tronco: { tipo: 'uniforme', cor: '#6b6b4a', colunas: 1 }, frente: [{ tipo: 'cinto' }], chapeu: { tipo: 'capacete_ww1' } },
  soldado_ww2: { tronco: { tipo: 'uniforme', cor: '#5e6b3a', colunas: 1 }, frente: [{ tipo: 'cinto' }], chapeu: { tipo: 'capacete_ww2' } },
  explorador_colonial: { tronco: { tipo: 'uniforme', cor: '#d9c9a0', colunas: 1, cor2: '#8a6e4a' }, frente: [{ tipo: 'cinto' }], chapeu: { tipo: 'capacete_colonial' }, rosto: [{ tipo: 'bigode', estilo: 'grande', cor: '#5a3a1a' }] },
  astronauta: { tronco: { tipo: 'espacial', cor2: '#2f6fd6' }, chapeu: { tipo: 'capacete_astronauta' }, bracos: 'branco', bota: '#eef1f5' },
  cientista: { tronco: { tipo: 'jaleco' }, rosto: [{ tipo: 'oculos' }] },
  medico: { tronco: { tipo: 'jaleco', cor2: '#7fd6b3' }, frente: [{ tipo: 'estetoscopio' }] },
  chef: { tronco: { tipo: 'uniforme', cor: WHITE, colunas: 2, cor2: '#555' }, frente: [{ tipo: 'lenco_pescoco' }], chapeu: { tipo: 'chef' } },
  operario: { tronco: { tipo: 'macacao' }, chapeu: { tipo: 'capacete_obra' } },
  formando: { tronco: { tipo: 'liso', cor: '#1b1b1b' }, baixo: { tipo: 'manto_longo', cor: '#1b1b1b' }, chapeu: { tipo: 'capelo' } },
  empresario: { tronco: { tipo: 'terno', cor: '#2b2f36', cor2: '#2f6fd6' } },
  turista_americano: { tronco: { tipo: 'liso', cor: '#3f9b6a' }, chapeu: { tipo: 'bone', cor: '#c62828' }, rosto: [{ tipo: 'oculos_sol' }] },
};
for (const [k, v] of Object.entries(PRESETS)) COSTUMES[k] = makeCostume(v);
/* sugestão de pose/objeto para a galeria */
const GALLERY_HINT = { homem_das_cavernas: ['segurar_lanca', 'clava'], legionario: ['segurar_lanca', 'lanca', 'escudo_romano'], centuriao: ['apontar', null], hoplita: ['segurar_lanca', 'lanca', 'escudo'],
  espartano: ['segurar_lanca', 'lanca', 'escudo'], filosofo: ['segurar', 'pergaminho'], gladiador: ['segurar_lanca', 'tridente'], imperador_romano: ['apontar', null], farao: ['segurar_lanca', 'cetro'],
  viking: ['segurar_lanca', 'machado', 'escudo'], viking_mito: ['dar_de_ombros', null], cavaleiro: ['erguer', 'espada', 'escudo'], cruzado: ['segurar_lanca', 'bandeira'], monge: ['segurar', 'livro'],
  samurai: ['erguer', 'katana'], ninja: ['erguer', 'katana'], shogun: ['maos_na_cintura', null], mandarim: ['segurar', 'pergaminho'], soldado_terracota: ['segurar_lanca', 'lanca'], maraja: ['segurar_lanca', 'cetro'],
  pai_fundador: ['segurar', 'pergaminho'], casaca_vermelha: ['segurar_lanca', 'mosquete'], cowboy: ['acenar', 'laco'], xerife: ['maos_na_cintura', null], pioneiro: ['segurar_lanca', 'mosquete'],
  soldado_mexicano: ['segurar_lanca', 'mosquete'], conquistador: ['erguer', 'espada'], soldado_uniao: ['segurar_lanca', 'bandeira'], napoleao: ['maos_na_cintura', null], revolucionario: ['segurar_lanca', 'bandeira'],
  cavalheiro_vitoriano: ['segurar_lanca', 'bengala'], dama_vitoriana: ['segurar_lanca', 'guarda_chuva'], rainha_vitoria: ['segurar', 'xicara'], detetive: ['apontar', 'lupa'], pirata: ['erguer', 'espada', 'bau'],
  soldado_ww1: ['segurar_lanca', 'mosquete'], soldado_ww2: ['segurar_lanca', 'mosquete'], astronauta: ['acenar', 'bandeira'], cientista: ['segurar', 'globo'], chef: ['segurar_lanca', 'pao'],
  formando: ['segurar', 'pergaminho'], empresario: ['segurar_lanca', 'saco_dinheiro'], explorador_colonial: ['segurar', 'telescopio'], czar: ['segurar_lanca', 'cetro'], guarda_real: ['segurar_lanca', 'mosquete'],
  turista_americano: ['acenar', null], bobo_da_corte: ['comemorar', null], kimono: ['segurar', 'xicara'], imperador_chines: ['segurar', 'pergaminho'], campones: ['segurar_lanca', 'tocha'], papai_noel: ['segurar', 'presente'], bispo: ['segurar_lanca', 'cajado'], puritano: ['segurar', 'livro'], asteca: ['segurar_lanca', 'lanca'],
  revolucionario_mexicano: ['segurar_lanca', 'mosquete'], cosmonauta: ['acenar', null], rei_frances: ['segurar_lanca', 'cetro'], maria_antonieta: ['segurar', 'pizza'], atleta_grego: ['comemorar', null], russo: ['segurar', 'xicara'],
  medico: ['segurar_lanca', 'garrafa'], formando: ['segurar', 'pergaminho'], turista: ['acenar', 'coracao'], cavalheiro_vitoriano: ['segurar_lanca', 'flores'], viking_mito: ['dar_de_ombros', null], operario: ['segurar_lanca', 'trevo'],
  godo: ['segurar_lanca', 'machado'], gaules: ['maos_na_cintura', null], joana_darc: ['segurar_lanca', 'bandeira'], alexandre: ['erguer', 'espada'], czar_sem_barba: ['dar_de_ombros', null],
  barba_negra: ['erguer', 'espada'], jogador_criquete: ['segurar', 'bola'], rainha_margherita: ['segurar', 'pizza'] };

/* ---------------- ESTADO DO SAM NO TEMPO t ---------------- */
function samState(sam, t, mouthAt) {
  const st = { x: sam.x, y: sam.chao, s: sam.escala || 1, figurino: sam.figurino || 'eua', visible: sam.visivel !== false, prop2: sam.prop2 || null, propCores: sam.propCores || null,
    lean: 0, sx: 1, sy: 1, jump: 0, shakeX: 0, walk: 0, walkPhase: 0, peek: null, prop: sam.prop || null, propRot: 0,
    fala: sam.fala !== false, speed: 0, flyMap: null };
  let poseName = sam.pose || 'idle', prevPose = poseName, tPose = -1e9;
  let expr = sam.expressao || 'deadpan';
  let look = sam.olhar || 0, prevLook = look, tLook = -1e9, lookY = sam.olharY || 0;
  st.prancha = sam.prancha || null;
  let propRot = 0, prevPropRot = 0, tPropRot = -1e9;
  const keys = (sam.chaves || []).slice().sort((a, b) => a.t - b.t);
  for (const k of keys) {
    if (k.t > t) break;
    if (k.pose && k.pose !== poseName) { prevPose = poseName; poseName = k.pose; tPose = k.t; }
    if (k.expressao) expr = k.expressao;
    if (k.olhar !== undefined) { prevLook = look; look = k.olhar; tLook = k.t; }
    if (k.olharY !== undefined) lookY = k.olharY;
    if (k.prancha !== undefined) st.prancha = k.prancha;
    if (k.x !== undefined) st.x = k.x;
    if (k.figurino) st.figurino = k.figurino;
    if (k.prop !== undefined) st.prop = k.prop;
    if (k.propMao !== undefined) st.propMao = k.propMao;
    if (k.prop2 !== undefined) st.prop2 = k.prop2;
    if (k.propMao2 !== undefined) st.propMao2 = k.propMao2;
    if (k.propCores !== undefined) st.propCores = k.propCores;
    if (k.propRot !== undefined) { prevPropRot = propRot; propRot = k.propRot; tPropRot = k.t; }
    if (k.fala !== undefined) st.fala = k.fala;
    if (k.visivel !== undefined) st.visible = k.visivel;
  }
  st.poseName = poseName;
  st.pose = blendPose(POSES[prevPose] || POSES.idle, POSES[poseName] || POSES.idle, Ease.back(inv(tPose, tPose + 0.24, t)));
  st.expr = expr;
  st.look = lerp(prevLook, look, Ease.out(inv(tLook, tLook + 0.15, t)));
  st.lookY = lookY;
  st.propRot = lerp(prevPropRot, propRot, Ease.back(inv(tPropRot, tPropRot + 0.35, t)));
  for (const a of (sam.acoes || [])) {
    if (a.ate !== undefined && t >= a.ate) continue;
    if (a.tipo === 'andar' && t >= a.t0) {
      const k = inv(a.t0, a.t1, t); st.x = lerp(a.x0, a.x1, k);
      if (t < a.t1) { st.walk = 1; st.walkPhase = (t - a.t0) * TAU * 2.0; st.lean = Math.sign(a.x1 - a.x0) * 4; }
      else { const d = t - a.t1; if (d < 0.25) { const e = Math.sin(Math.PI * d / 0.25); st.sy = 1 - 0.07 * e; st.sx = 1 + 0.05 * e; } }
    } else if (a.tipo === 'susto') {
      const d = t - a.t;
      if (d >= 0 && d < 0.62) {
        if (d < 0.36) { const e = Math.sin(Math.PI * d / 0.36); st.jump = e * (a.altura || 46); st.sy = 1 + 0.12 * e; st.sx = 1 - 0.08 * e; }
        else { const e = Math.sin(Math.PI * (d - 0.36) / 0.26); st.sy = 1 - 0.1 * e; st.sx = 1 + 0.08 * e; }
        if (d < 0.32) st.shakeX = Math.sin(d * 95) * 9 * (1 - d / 0.32);
      }
    } else if (a.tipo === 'sair') {
      const d = t - a.t;
      if (d >= 0) {
        const dur = a.dur || 0.22, k = clamp(d / dur, 0, 1);
        if (d < 0.08) { const e = Math.sin(Math.PI * d / 0.08); st.sy = 1 - 0.12 * e; st.sx = 1 + 0.1 * e; }
        else { const km = clamp((d - 0.08) / dur, 0, 1); st.x = lerp(st.x, a.xFim, Ease.in(km)); st.lean = (a.xFim > st.x ? 1 : -1) * 14; st.speed = km < 1 ? 1 : 1 - clamp((d - 0.08 - dur) / 0.25, 0, 1); st.speedX0 = a.xIni; }
        if (d > 0.08 + dur) st.visible = false;
      }
    } else if (a.tipo === 'espiar' && t >= a.t0 && t <= a.t1) {
      const kin = Ease.back(inv(a.t0, a.t0 + 0.2, t)), kout = Ease.in(inv(a.t1 - 0.18, a.t1, t));
      st.peek = { k: kin * (1 - kout), lado: a.lado || 'direita', ladoV: a.ladoV, y: a.y || 520, expr: a.expressao || 'deadpan' };
    } else if (a.tipo === 'piscar') {
      if (Math.abs(t - a.t) < 0.09) st.forceBlink = 1 - Math.abs(t - a.t) / 0.09;
    } else if (a.tipo === 'soltar_mapa') {
      const d = t - a.t; if (d >= 0 && d < 1.4) st.flyMap = d;
      if (d >= 0) st.prop = null;
    }
  }
  // piscadas automáticas (determinísticas)
  let blink = st.forceBlink || 0;
  for (let n = 0; n < 40; n++) {
    const tb = 1.1 + n * 3.0 + hash(n + (sam.seed || 0)) * 1.6;
    if (tb > t + 1) break;
    const d = Math.abs(t - tb); if (d < 0.08) blink = Math.max(blink, 1 - d / 0.08);
  }
  st.blink = blink;
  st.mouth = st.fala && mouthAt ? mouthAt(t) : 0;
  st.t = t;
  return st;
}

/* ---------------- DESENHO DO SAM ---------------- */
function armPoints(side, ang, lift) {
  const S = [side * RIG.shoulderX, RIG.shoulderY + lift];
  const a1 = ang[0] * D2R, a12 = (ang[0] + ang[1]) * D2R;
  const E = [S[0] + side * Math.sin(a1) * RIG.upper, S[1] + Math.cos(a1) * RIG.upper];
  const H = [E[0] + side * Math.sin(a12) * RIG.fore, E[1] + Math.cos(a12) * RIG.fore];
  return { S, E, H, dir: [side * Math.sin(a12), Math.cos(a12)] };
}
function drawLimb(ctx, pts, style, w) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  if (style === 'white') { path(); ctx.strokeStyle = INK; ctx.lineWidth = w + 14; ctx.stroke(); path(); ctx.strokeStyle = '#fafafa'; ctx.lineWidth = w + 2; ctx.stroke(); }
  else { path(); ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke(); }
}
function drawHeadAndFace(ctx, st, C, tilt) {
  const R = RIG.headR;
  ctx.save(); ctx.rotate(tilt * D2R);
  if (C && C.hatBack) C.hatBack(ctx, R);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = '#fbfbfb'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#dcdcdc'; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.beginPath(); ctx.arc(-0.07 * R, -0.09 * R, R * 0.985, 0, TAU); ctx.fillStyle = '#fbfbfb'; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.lineWidth = RIG.ol; ctx.strokeStyle = INK; ctx.stroke();
  drawFace(ctx, R, st);
  if (C && C.face) C.face(ctx, R);
  if (C && C.hat) C.hat(ctx, R);
  ctx.restore();
}
function drawFace(ctx, R, st) {
  const E = EXPR[st.expr] || EXPR.deadpan;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.fillStyle = INK;
  const eyeX = 0.37 * R, eyeY = -0.03 * R, lx = clamp(st.look, -1, 1) * 0.075 * R, ly = (st.lookY || 0) * 0.05 * R;
  const blink = (E.eyes === 'lid' || E.eyes === 'wide') ? st.blink : 0;
  // sobrancelhas
  const by = -0.36 * R, bw = 0.23 * R; ctx.lineWidth = 0.075 * R;
  for (const side of [-1, 1]) {
    let yi = by, yo = by;
    if (E.brows === 'up') { yi = yo = by - 0.13 * R; }
    else if (E.brows === 'up_small') { yi = yo = by - 0.06 * R; }
    else if (E.brows === 'worried') { yi = by - 0.15 * R; yo = by - 0.02 * R; }
    else if (E.brows === 'angry') { yi = by + 0.07 * R; yo = by - 0.05 * R; }
    else if (E.brows === 'one_up' && side > 0) { yi = yo = by - 0.14 * R; }
    ctx.beginPath(); ctx.moveTo(side * (eyeX - bw), yi); ctx.lineTo(side * (eyeX + bw * 1.05), yo); ctx.stroke();
  }
  // olhos
  for (const side of [-1, 1]) {
    const ex = side * eyeX;
    if (E.eyes === 'lid') {
      const ly0 = eyeY - 0.03 * R, pr = 0.105 * R, open = 1 - blink;
      ctx.beginPath(); ctx.ellipse(ex + lx, ly0 + ly * 0.3, pr, pr * Math.max(open, 0.02), 0, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 0.06 * R; ctx.beginPath(); ctx.moveTo(ex - 0.17 * R, ly0); ctx.lineTo(ex + 0.17 * R, ly0); ctx.stroke();
    } else if (E.eyes === 'wide') {
      const open = 1 - blink;
      ctx.beginPath(); ctx.ellipse(ex + lx, eyeY + ly, 0.125 * R, 0.135 * R * Math.max(open, 0.04), 0, 0, TAU); ctx.fill();
      if (open > 0.5) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + lx - 0.04 * R, eyeY + ly - 0.045 * R, 0.035 * R, 0, TAU); ctx.fill(); ctx.fillStyle = INK; }
    } else if (E.eyes === 'closed') {
      ctx.lineWidth = 0.06 * R; ctx.beginPath(); ctx.arc(ex, eyeY - 0.06 * R, 0.13 * R, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (E.eyes === 'happy') {
      ctx.lineWidth = 0.065 * R; ctx.beginPath(); ctx.arc(ex, eyeY + 0.03 * R, 0.12 * R, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    }
  }
  // boca
  const my = 0.40 * R, m = clamp(st.mouth || 0, 0, 1);
  ctx.lineWidth = 0.065 * R;
  if (E.mouth === 'o') {
    ctx.fillStyle = '#2a0c0c'; ctx.beginPath(); ctx.ellipse(0, my, 0.1 * R, 0.13 * R + 0.05 * R * m, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 0.05 * R; ctx.stroke(); ctx.fillStyle = INK;
  } else if (m > 0.05 && (E.mouth === 'line' || E.mouth === 'smirk')) {
    const w = 0.34 * R, h = 0.045 * R + 0.24 * R * m;
    ctx.fillStyle = '#2a0c0c'; rr(ctx, -w / 2, my - h * 0.3, w, h, Math.min(h / 2, 0.08 * R)); ctx.fill();
    ctx.lineWidth = 0.05 * R; ctx.stroke();
    if (h > 0.14 * R) { ctx.fillStyle = '#c9504f'; ctx.beginPath(); ctx.ellipse(0, my - h * 0.3 + h * 0.78, w * 0.26, h * 0.16, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = INK;
  } else if (E.mouth === 'smirk') {
    ctx.beginPath(); ctx.moveTo(-0.19 * R, my + 0.01 * R); ctx.quadraticCurveTo(0.06 * R, my + 0.08 * R, 0.21 * R, my - 0.07 * R); ctx.stroke();
  } else if (E.mouth === 'smile') {
    ctx.beginPath(); ctx.arc(0, my - 0.12 * R, 0.22 * R, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-0.19 * R, my); ctx.lineTo(0.19 * R, my); ctx.stroke();
  }
  if (E.sweat) {
    ctx.fillStyle = '#7cc7ff'; ctx.strokeStyle = INK; ctx.lineWidth = 0.035 * R;
    ctx.beginPath(); ctx.moveTo(0.78 * R, -0.62 * R); ctx.quadraticCurveTo(0.92 * R, -0.36 * R, 0.78 * R, -0.3 * R);
    ctx.quadraticCurveTo(0.64 * R, -0.36 * R, 0.78 * R, -0.62 * R); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK;
  }
}
function drawMapProp(ctx, w, h, rot) {
  ctx.save(); ctx.rotate(rot * D2R);
  ctx.fillStyle = '#efdcae'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2 + 4); ctx.lineTo(w / 2 - 3, h / 2); ctx.lineTo(-w / 2 + 2, h / 2 - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b98e52'; ctx.beginPath(); ctx.ellipse(-w * 0.18, 0, w * 0.13, h * 0.3, 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * 0.2, -h * 0.05, w * 0.1, h * 0.33, -0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(w * 0.25, -h * 0.3); ctx.quadraticCurveTo(-w * 0.05, 0, -w * 0.15, h * 0.2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#c0392b'; ctx.font = `bold ${Math.round(h * 0.28)}px ${FONT_SUB}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X', -w * 0.15, h * 0.22);
  ctx.restore();
}
function drawSam(ctx, st) {
  const C = COSTUMES[st.figurino] || COSTUMES.eua;
  if (st.peek) { drawPeek(ctx, st, C); return; }
  if (!st.visible) return;
  const t = st.t, P = st.pose, s = st.s;
  // sombra no chão
  ctx.save(); ctx.translate(st.x, st.y); ctx.scale(s, s);
  const sh = 1 - clamp(st.jump / 120, 0, 0.5);
  ctx.fillStyle = 'rgba(30,20,10,0.28)'; ctx.beginPath(); ctx.ellipse(0, 2, 92 * sh, 15 * sh, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(st.x + st.shakeX, st.y - st.jump);
  ctx.rotate(st.lean * D2R);
  ctx.scale(s * st.sx, s * st.sy);
  const breath = Math.sin(t * TAU / 3.1), bob = st.walk ? -Math.abs(Math.sin(st.walkPhase)) * 7 : 0;
  ctx.translate(0, bob);
  const lift = (P.ombros || 0) + breath * 1.2;
  if (C.back) C.back(ctx, lift);
  // pernas
  const legSw = st.walk ? Math.sin(st.walkPhase) * 22 : 0;
  for (const side of [-1, 1]) {
    const phi = side * legSw * D2R + side * 2 * D2R;
    const hip = [side * RIG.hipX, RIG.hipY];
    const foot = [hip[0] + Math.sin(phi) * RIG.legLen, hip[1] + Math.cos(phi) * RIG.legLen];
    drawLimb(ctx, [hip, foot], 'black', RIG.limbW + 3);
    ctx.fillStyle = C.boot || INK; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(foot[0] + side * 9, foot[1] + 1, RIG.footRx, RIG.footRy, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  if (C.lower) C.lower(ctx, lift);
  // pescoço
  ctx.fillStyle = '#fbfbfb'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  const nTop = HEAD_CY + RIG.headR * 0.7, nBot = RIG.torsoTop + lift + 8;
  ctx.fillRect(-RIG.neckW / 2, nTop, RIG.neckW, nBot - nTop);
  ctx.beginPath(); ctx.moveTo(-RIG.neckW / 2, nTop); ctx.lineTo(-RIG.neckW / 2, nBot); ctx.moveTo(RIG.neckW / 2, nTop); ctx.lineTo(RIG.neckW / 2, nBot); ctx.stroke();
  // tronco (figurino)
  ctx.save(); torsoPath(ctx, lift); ctx.clip(); C.torso(ctx, lift); ctx.restore();
  torsoPath(ctx, lift); ctx.lineWidth = RIG.ol; ctx.strokeStyle = INK; ctx.stroke();
  if (C.front) C.front(ctx, lift);
  // braços
  const wave = P.onda ? Math.sin(t * TAU * 3) * 22 : 0;
  const arms = {};
  for (const [key, side] of [['R', 1], ['L', -1]]) {
    const ang = P[key].slice(); if (P.onda === key) ang[1] += wave;
    arms[key] = armPoints(side, ang, lift);
  }
  // objeto de cena segurado com as duas mãos (mapa, bateia, taça, livro, planta)
  if (st.prop && PROPS_DUAS_MAOS.has(st.prop)) {
    const cx = (arms.R.H[0] + arms.L.H[0]) / 2, cy = (arms.R.H[1] + arms.L.H[1]) / 2 - 8;
    ctx.save(); ctx.translate(cx, cy); drawPropTwoHands(ctx, st.prop, st.propRot || 0, st.propCores); ctx.restore();
  }
  for (const key of ['R', 'L']) {
    const A = arms[key];
    drawLimb(ctx, [A.S, A.E, A.H], C.armStyle, RIG.limbW);
    if (C.sleeve) { ctx.fillStyle = C.sleeve; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(A.S[0], A.S[1] + 4, 17, 0, TAU); ctx.fill(); ctx.stroke(); }
  }
  // objeto de cena numa mão só (espada, cetro, machado, pena, microfone, bola)
  if (st.prop && !PROPS_DUAS_MAOS.has(st.prop)) drawPropOneHand(ctx, st.prop, arms[st.propMao ? (st.propMao === 'L' ? 'L' : 'R') : (PROPS_ESCUDO.has(st.prop) ? 'L' : 'R')], st.propCores);
  if (st.prop2 && !PROPS_DUAS_MAOS.has(st.prop2)) drawPropOneHand(ctx, st.prop2, arms[st.propMao2 === 'R' ? 'R' : 'L'], st.propCores);
  for (const key of ['R', 'L']) {
    const A = arms[key];
    if (P.dedo === key) {
      ctx.strokeStyle = C.armStyle === 'white' ? '#fafafa' : INK; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(A.H[0], A.H[1]); ctx.lineTo(A.H[0] + A.dir[0] * 26, A.H[1] + A.dir[1] * 26); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(A.H[0], A.H[1], C.armStyle === 'white' ? RIG.handR + 3 : RIG.handR, 0, TAU);
    ctx.fillStyle = C.armStyle === 'white' ? '#fafafa' : INK; ctx.fill();
    if (C.armStyle === 'white') { ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); }
  }
  // cabeça
  const talkTilt = (st.mouth || 0) * 2.2 * Math.sin(t * 5.3);
  ctx.save(); ctx.translate(0, HEAD_CY + lift * 0.6 + breath * 1.5);
  drawHeadAndFace(ctx, st, C, (P.cab || 0) + talkTilt + (st.headTilt || 0));
  ctx.restore();
  ctx.restore();
}
function drawPeek(ctx, st, C) {
  const p = Object.assign({}, st.peek), s = st.s * 1.15, k = p.k; if (VIEW.v) p.lado = p.ladoV || 'esquerda';
  const v0 = VIEW.x0, v1 = VIEW.x1;
  const x = p.lado === 'esquerda' ? lerp(v0 - 120, v0 + 150, k) : lerp(v1 + 120, v1 - 150, k);
  ctx.save(); ctx.translate(x, p.y); ctx.rotate((p.lado === 'esquerda' ? 18 : -18) * D2R); ctx.scale(s, s);
  ctx.fillStyle = '#fbfbfb'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.fillRect(-15, 60, 30, 120); ctx.beginPath(); ctx.moveTo(-15, 60); ctx.lineTo(-15, 180); ctx.moveTo(15, 60); ctx.lineTo(15, 180); ctx.stroke();
  const st2 = Object.assign({}, st, { expr: p.expr, look: p.lado === 'esquerda' ? 0.6 : -0.6 });
  drawHeadAndFace(ctx, st2, C, 0);
  ctx.restore();
}

/* ---------------- MAPA DE EXPLICAÇÃO ---------------- */
const LAND = {
  na: [[-95,53],[-60,53],[-55.5,51],[-59.5,47.5],[-64,45],[-66,44],[-70,43.5],[-70.5,41.6],[-74,40.4],[-76.3,37.6],[-75.5,35.3],[-78,33.8],[-81,31.5],[-80.4,27.5],[-80.2,25.3],[-81.6,25.6],[-82.8,28],[-84,30],[-89,30.3],[-94,29.6],[-95,28.5]],
  ca: [[-95,18.5],[-91,18.4],[-88,21.5],[-87,21],[-88.2,15.8],[-83.2,15],[-83.6,11],[-82,9],[-79.5,9.4],[-77.3,8.6],[-79.5,7.3],[-80.6,7.6],[-83.5,8.3],[-85.8,10.4],[-87.6,12.9],[-91.5,13.9],[-95,16]],
  cuba: [[-84.9,21.9],[-80,23],[-77,21.5],[-74.2,20.2],[-77.5,19.9],[-80,21.7],[-84.5,21.5]],
  hisp: [[-74.4,19.8],[-70,19.8],[-68.4,18.6],[-71.5,17.6],[-74.4,18.4]],
  sa: [[-79,9],[-77,8],[-75,11],[-72,12],[-67,11],[-62,10.5],[-60,8],[-57,6],[-52,4.5],[-50,1],[-48,-1],[-44,-2.5],[-40,-3],[-37,-5],[-35,-7],[-35,-9],[-37,-12],[-39,-15],[-39.5,-18],[-41,-22],[-44,-23],[-48,-26],[-48.5,-28],[-51,-31],[-53,-34],[-57,-35],[-58,-38],[-62,-39],[-63,-42],[-71,-42],[-73,-38],[-73,-33],[-71,-30],[-70,-24],[-70,-18],[-75,-15],[-77,-12],[-79,-8],[-81,-5],[-80,-2],[-80,1],[-78,4],[-77,7]],
  eu: [[-9.5,37],[-9,43.5],[-1.8,43.4],[-1.2,46.2],[-4.5,48.3],[-1.5,49.6],[2,51],[5,53],[40,53],[40,46],[36,45.5],[30,45.5],[28,41],[26,40.7],[23.5,38],[22.5,36.5],[21,38.5],[19.5,40.8],[16,43.5],[13.7,45.6],[12.3,44.3],[15.5,40.3],[16,38.1],[15.6,40.2],[12.8,42],[10.5,43.8],[8,44.2],[6,43.1],[3.2,43.3],[3.1,42],[0.9,41],[0,39.4],[-0.6,37.6],[-2,36.7],[-5.5,36],[-6.5,36.9],[-7.5,37.2]],
  uk: [[-5.7,50],[1.7,51.5],[0.5,53],[-3,53],[-5,52.5]],
  af: [[-17,21],[-16,24],[-13,27.5],[-10,30],[-9.5,33],[-6,35.8],[0,35.9],[5,36.8],[10,37.2],[11,35],[10,33],[15,32],[20,31],[25,31.6],[32,31.3],[34,28],[35,24],[37,20],[39,16],[42,12.5],[43.5,11.5],[51,11.8],[51,10],[48,5],[43,0],[41,-2],[40,-5],[39.5,-10],[40.5,-15],[37,-18],[35,-22],[35.5,-24],[33,-26],[32.5,-28.5],[30,-31],[27,-33.5],[22,-34],[20,-34.8],[18,-33],[17.5,-29],[15,-26],[14.5,-22],[12,-17],[13.5,-12],[12,-6],[9,-1],[9.5,3],[8,4.5],[5,6],[2,6.3],[-2,5],[-5,5.2],[-8,4.5],[-11,6.5],[-13,8.5],[-15,11],[-17,14.5],[-17,18],[-16,20]],
  mad: [[44,-25],[47,-25],[50,-15],[49.5,-12],[47,-15],[44,-18],[43.5,-22]],
  as: [[35.5,36.7],[35,33],[34.3,31.3],[34.6,29],[35,28],[36.5,26],[39,22],[42,16],[43.5,12.7],[45,13],[48.5,14],[52,16],[55,17.5],[57.5,18.8],[59.8,22.4],[57,24.5],[56.3,26.4],[54,24.3],[51.6,24.2],[50.5,26],[48.5,28.5],[48,30],[50,30],[54,27],[57,25.6],[61.5,25.2],[66.5,25.4],[68,23.6],[70,21],[72.8,19],[73.5,15.5],[74.8,12.8],[76,9.5],[77.5,8],[78.2,8.8],[79.3,10.3],[80,13],[80.3,15.8],[82,17],[85,19.5],[85,53],[40,53],[40,46],[42,41.5],[36,41.5],[36,36.7]],
  lk: [[79.8,9.8],[81.8,7.5],[81.2,6],[80,6.5]],
};
const MAP_EXT = { lon0: -95, lon1: 85, lat0: -42, lat1: 53 };
function proj(lon, lat, w, h) { return [(lon - MAP_EXT.lon0) / (MAP_EXT.lon1 - MAP_EXT.lon0) * w, (MAP_EXT.lat1 - lat) / (MAP_EXT.lat1 - MAP_EXT.lat0) * h]; }
function smoothPath(pts) { // Catmull-Rom -> pontos densos
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < 16; j++) { const t = j / 16, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  out.push(pts[pts.length - 1]); return out;
}
function partial(pts, k) { // primeiros k (0..1) do comprimento
  let L = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
  let target = L * k, out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (target >= seg[i - 1]) { out.push(pts[i]); target -= seg[i - 1]; }
    else { const f = seg[i - 1] ? target / seg[i - 1] : 0; out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; }
  }
  return out;
}
function drawShip(ctx, x, y, sc, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
  ctx.fillStyle = '#6b3f1d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(14, 2); ctx.lineTo(9, 9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.moveTo(-1, -16); ctx.lineTo(10, 0); ctx.lineTo(-1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.fillRect(2, -9, 3, 6);
  ctx.restore();
}
function mapBox(L) {
  const w = L.v ? 650 : 700, mh = w * (MAP_EXT.lat1 - MAP_EXT.lat0) / (MAP_EXT.lon1 - MAP_EXT.lon0), pad = 18, hh = L.v ? 56 : 44;
  return { w, mh, pad, hh, H: mh + pad * 2 + hh, x: L.v ? (L.W - w - pad * 2) / 2 - 40 : 34, y: L.v ? SAFE_V.topo : 34 };
}
function drawMapCard(ctx, L, ev, t) {
  const a = vis(t, ev.t0, ev.t1, 0.3, 0.3); if (a <= 0) return;
  const { w, mh, pad, hh, H, x, y } = mapBox(L);
  const pop = Ease.back(inv(ev.t0, ev.t0 + 0.35, t));
  ctx.save(); ctx.globalAlpha = a;
  ctx.translate(x + (w + pad * 2) / 2, y + H / 2); ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop); ctx.rotate(-1.2 * D2R); ctx.translate(-(w + pad * 2) / 2, -H / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#f1dfb0'; rr(ctx, 0, 0, w + pad * 2, H, 14); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 6; ctx.strokeStyle = '#4a2c12'; ctx.stroke();
  ctx.fillStyle = '#4a2c12'; ctx.font = `${L.v ? 28 : 26}px ${FONT_DISPLAY}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(ev.titulo || 'THE VOYAGE', pad + 4, hh / 2 + 6);
  ctx.save(); ctx.translate(pad, hh); rr(ctx, 0, 0, w, mh, 8); ctx.clip();
  ctx.fillStyle = '#cfe3e6'; ctx.fillRect(0, 0, w, mh);
  ctx.globalAlpha = a * 0.25; ctx.strokeStyle = '#7da3ab'; ctx.lineWidth = 1;
  for (let lon = -90; lon <= 80; lon += 30) { const p = proj(lon, 0, w, mh); ctx.beginPath(); ctx.moveTo(p[0], 0); ctx.lineTo(p[0], mh); ctx.stroke(); }
  for (let lat = -30; lat <= 50; lat += 30) { const p = proj(0, lat, w, mh); ctx.beginPath(); ctx.moveTo(0, p[1]); ctx.lineTo(w, p[1]); ctx.stroke(); }
  ctx.globalAlpha = a;
  ctx.fillStyle = '#d9b77a'; ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  for (const k in LAND) { const poly = LAND[k]; ctx.beginPath(); poly.forEach((q, i) => { const p = proj(q[0], q[1], w, mh); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (ev.destaque) for (const d of ev.destaque) { if (t < d.t) continue; const poly = LAND[d.terra]; if (!poly) continue;
    const k = Ease.out(inv(d.t, d.t + 0.3, t)); ctx.fillStyle = `rgba(46,160,67,${0.75 * k})`;
    ctx.beginPath(); poly.forEach((q, i) => { const p = proj(q[0], q[1], w, mh); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.font = `bold ${L.v ? 20 : 18}px ${FONT_SUB}`; ctx.textAlign = 'center'; ctx.fillStyle = '#3d2410';
  for (const r of (ev.rotulos || [])) { if (r.t !== undefined && t < r.t) continue; const p = proj(r.lon, r.lat, w, mh); ctx.fillText(r.txt, p[0], p[1]); }
  for (const rt of (ev.rotas || [])) {
    const pts = smoothPath(rt.pontos.map(q => proj(q[0], q[1], w, mh)));
    const k = rt.t0 === undefined ? 1 : Ease.inOut(inv(rt.t0, rt.t1, t)); if (k <= 0) continue;
    const pp = partial(pts, k);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (rt.estilo === 'planejado') { ctx.setLineDash([9, 8]); ctx.strokeStyle = 'rgba(60,60,60,0.75)'; ctx.lineWidth = L.v ? 5 : 3.5; }
    else { ctx.setLineDash([]); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = L.v ? 7 : 5; }
    ctx.beginPath(); pp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.setLineDash([]);
    if (rt.navio && k > 0 && k < 1.0001 && t <= (rt.t1 + (rt.fica || 0.6))) {
      const h = pp[pp.length - 1], h0 = pp[Math.max(0, pp.length - 3)];
      drawShip(ctx, h[0], h[1] - 4, L.v ? 1.5 : 1.1, clamp(Math.atan2(h[1] - h0[1], h[0] - h0[0]) * 0.25, -0.4, 0.4));
    }
  }
  for (const mk of (ev.marcadores || [])) {
    if (t < mk.t) continue; const p = proj(mk.lon, mk.lat, w, mh), k = Ease.elastic(inv(mk.t, mk.t + 0.5, t));
    ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(k, k);
    if (mk.tipo === 'bang') {
      ctx.fillStyle = YELLOW; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8, r = i % 2 ? 11 : 24; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `${L.v ? 26 : 20}px ${FONT_DISPLAY}`; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 1);
    } else { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (mk.txt) { ctx.font = `${L.v ? 24 : 17}px ${FONT_DISPLAY}`; ctx.lineWidth = 5; ctx.strokeStyle = '#f1dfb0'; ctx.fillStyle = '#7a1a10'; ctx.textBaseline = 'middle';
      ctx.strokeText(mk.txt, mk.dx || 0, (mk.dy || -28)); ctx.fillText(mk.txt, mk.dx || 0, (mk.dy || -28)); }
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

/* ---------------- OVERLAYS DE TELA ---------------- */
function dateTagBox(ctx, L, txt) {
  const fs = L.v ? 46 : 34; ctx.save(); ctx.font = `bold ${fs}px ${FONT_SUB}`; const w = ctx.measureText(txt).width + fs * 0.9, h = fs * 1.5; ctx.restore();
  return { fs, w, h, x: L.W - w - (L.v ? 72 : 30), y: L.v ? 280 : 28 };
}
function drawDateTag(ctx, L, txt, pulse) {
  const { fs, w, h, x, y } = dateTagBox(ctx, L, txt), sc = 1 + 0.2 * pulse; ctx.save();
  ctx.font = `bold ${fs}px ${FONT_SUB}`;
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(12,12,12,0.92)'; rr(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 2);
  ctx.restore();
}
function drawSubtitles(ctx, L, blocks, t) {
  const b = blocks.find(q => t >= q.t0 && t < q.t1); if (!b) return;
  const words = b.palavras; let fs = L.v ? 66 : 50; const maxW = L.v ? 820 : L.W - 360, minFs = L.v ? 54 : 26;
  ctx.save();
  const lay = () => {
    ctx.font = `bold ${fs}px ${FONT_SUB}`; const sp = ctx.measureText(' ').width, ws = words.map(q => ctx.measureText(q[0]).width);
    const lineW = (a, z) => ws.slice(a, z).reduce((acc, v) => acc + v, 0) + sp * (z - a - 1);
    let lines = [[0, words.length]];
    if (L.v && words.length > 1 && lineW(0, words.length) > maxW) { let best = 1, bw = 1e9;
      for (let i = 1; i < words.length; i++) { const m = Math.max(lineW(0, i), lineW(i, words.length)); if (m < bw) { bw = m; best = i; } }
      lines = [[0, best], [best, words.length]]; }
    return { ws, sp, lines, lineW, W: Math.max(...lines.map(([a, z]) => lineW(a, z))) };
  };
  let M = lay(); while (M.W > maxW && fs > minFs) { fs -= 2; M = lay(); }
  const lh = fs * 1.2, padX = fs * 0.5, padY = fs * 0.32, h = lh * M.lines.length + padY * 2;
  const cx = L.v ? 505 : L.W / 2, cy = L.v ? 1270 : L.H - 100;
  const pop = 0.94 + 0.06 * Ease.out(inv(b.t0, b.t0 + 0.09, t));
  ctx.translate(cx, cy); ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(10,10,10,0.74)'; rr(ctx, -M.W / 2 - padX, -h / 2, M.W + padX * 2, h, fs * 0.36); ctx.fill();
  let cur = -1; for (let i = 0; i < words.length; i++) if (t >= words[i][1]) cur = i;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  M.lines.forEach(([a, z], li) => {
    let x = -M.lineW(a, z) / 2; const y = -h / 2 + padY + lh * (li + 0.5) + fs * 0.04;
    for (let i = a; i < z; i++) { ctx.fillStyle = i === cur ? YELLOW : '#ffffff'; ctx.fillText(words[i][0], x, y); x += M.ws[i] + M.sp; }
  });
  ctx.restore();
}
function nameBox(ctx, L, ev) {
  ctx.save(); let f1 = L.v ? 50 : 40, f2 = L.v ? 30 : 25;
  ctx.font = `${f1}px ${FONT_DISPLAY}`; let w1 = ctx.measureText(ev.nome).width;
  ctx.font = `bold ${f2}px ${FONT_SUB}`; let w2 = ctx.measureText(ev.sub || '').width; ctx.restore();
  if (L.v && Math.max(w1, w2) + 70 > 720) { const r = 650 / Math.max(w1, w2); f1 *= r; f2 *= r; w1 *= r; w2 *= r; } // não encosta na etiqueta de data
  return { f1, f2, w: Math.max(w1, w2) + 70, h: L.v ? 140 : 112, x: L.v ? SAFE_V.x0 : 60, y: L.v ? 280 : L.H - 300 };
}
function drawLowerThird(ctx, L, ev, t) {
  const k = Ease.out(inv(ev.t0, ev.t0 + 0.35, t)) * (1 - Ease.in(inv(ev.t1 - 0.3, ev.t1, t))); if (k <= 0) return;
  const { f1, f2, w, h, x, y } = nameBox(ctx, L, ev); ctx.save();
  ctx.translate(lerp(-w - 80, 0, k), 0); ctx.globalAlpha = clamp(k * 1.5, 0, 1);
  ctx.fillStyle = 'rgba(12,12,12,0.9)'; rr(ctx, x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = YELLOW; ctx.fillRect(x, y, 12, h);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.font = `${f1}px ${FONT_DISPLAY}`; ctx.fillText(ev.nome, x + 36, y + h * 0.5);
  ctx.fillStyle = '#d6d6d6'; ctx.font = `bold ${f2}px ${FONT_SUB}`; ctx.fillText(ev.sub || '', x + 36, y + h * 0.84);
  ctx.restore();
}
function drawPopCard(ctx, L, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const kin = Ease.elastic(inv(ev.t0, ev.t0 + 0.55, t)), kout = 1 - Ease.in(inv(ev.t1 - 0.2, ev.t1, t)), k = kin * kout; if (k <= 0) return;
  const fs = (ev.tam || 64) * (L.v ? 0.9 : 1);
  ctx.save(); ctx.font = `${fs}px ${FONT_DISPLAY}`; const lines = ev.txt.split('\n'); const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + fs * 0.9, h = lines.length * fs * 1.1 + fs * 0.7;
  const p = placeV(L, posV(L, ev), w / 2 + 14, h / 2 + 14 + (ev.icone ? fs * 0.55 : 0), h / 2 + 14);
  ctx.translate(p[0], p[1]); ctx.rotate((ev.rot || 0) * D2R + Math.sin((t - ev.t0) * 2.2) * 0.02); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
  ctx.fillStyle = ev.cor || '#ffffff'; rr(ctx, -w / 2, -h / 2, w, h, 16); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = ev.corTexto || INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((s, i) => ctx.fillText(s, 0, (i - (lines.length - 1) / 2) * fs * 1.1 + fs * 0.05));
  if (ev.icone) { ctx.translate(0, -h / 2 - 8); ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.arc(0, 0, fs * 0.5, 0, TAU); ctx.fill(); ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `${fs * 0.7}px ${FONT_DISPLAY}`; ctx.fillText(ev.icone, 0, fs * 0.04); }
  ctx.restore();
}
const stampCache = new Map();
const STAMP_COR = { vermelho: '#c62828', verde: '#1f9d55', azul: '#1e6fd9', laranja: '#e8710a', roxo: '#7b3fe4' };
function stampCanvas(txt, sub, fs, cor) {
  cor = STAMP_COR[cor] || cor || '#c62828';
  const key = txt + '|' + sub + '|' + fs + '|' + cor; if (stampCache.has(key)) return stampCache.get(key);
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `${fs}px ${FONT_STAMP}`; let w = g.measureText(txt).width + fs * 0.8; const h = fs * 1.25 + (sub ? fs * 0.38 : 0);
  if (sub) { g.font = `bold ${fs * 0.22}px ${FONT_SUB}`; w = Math.max(w, g.measureText(sub).width + fs * 0.6); }
  c.width = Math.ceil(w + 40); c.height = Math.ceil(h + 40); g.translate(20, 20);
  g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = fs * 0.07; rr(g, 0, 0, w, h, fs * 0.12); g.stroke();
  g.lineWidth = fs * 0.025; rr(g, fs * 0.09, fs * 0.09, w - fs * 0.18, h - fs * 0.18, fs * 0.08); g.stroke();
  g.font = `${fs}px ${FONT_STAMP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, fs * 0.66);
  if (sub) { g.font = `bold ${fs * 0.22}px ${FONT_SUB}`; g.fillText(sub, w / 2, fs * 1.3); }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) { const r = hash(i * 3.1) * fs * 0.035 + 0.6; g.globalAlpha = 0.25 + hash(i * 7.7) * 0.75;
    g.beginPath(); g.arc(hash(i * 1.3) * w, hash(i * 2.9) * h, r, 0, TAU); g.fill(); }
  stampCache.set(key, c); return c;
}
function drawStamp(ctx, L, ev, t) {
  if (t < ev.t || t > ev.t1) return;
  const d = t - ev.t, sc = d < 0.12 ? lerp(2.6, 1, Ease.in(d / 0.12)) : 1 + 0.04 * Math.sin(Math.min((d - 0.12) * 30, Math.PI)) * Math.exp(-(d - 0.12) * 8);
  const a = (d < 0.12 ? lerp(0, 0.95, d / 0.12) : 0.95) * (1 - inv(ev.t1 - 0.25, ev.t1, t));
  const c = stampCanvas(ev.txt, ev.sub || '', ev.tam || 150, ev.cor), rot = (ev.rot || -12) * D2R, cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  let s0 = L.v ? 0.9 : 1; const bw = (cs * c.width + sn * c.height) / 2, bh = (sn * c.width + cs * c.height) / 2;
  if (L.v && bw * 2 * s0 > SAFE_V.x1 - SAFE_V.x0) s0 = (SAFE_V.x1 - SAFE_V.x0) / (bw * 2);
  const p = placeV(L, posV(L, ev), bw * s0, bh * s0);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(p[0], p[1]); ctx.rotate(rot); ctx.scale(sc * s0, sc * s0);
  ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore();
}
function drawCalendar(ctx, L, ev, t) {
  const a = vis(t, ev.t0, ev.t1, 0.25, 0.25); if (a <= 0) return;
  const pop = Ease.back(inv(ev.t0, ev.t0 + 0.35, t));
  const w = 330, h = 360, S = L.v ? 1.05 : 1, offR = L.v ? 250 : 235;
  const p = placeV(L, posV(L, ev), w / 2 * S + 10, h / 2 * S + 26 * S, ev.rodape ? offR + 58 : h / 2 * S + 10);
  const n = Math.round(lerp(ev.de, ev.ate, clamp((t - ev.tA) / (ev.tB - ev.tA), 0, 1)));
  const frac = ((t - ev.tA) / (ev.tB - ev.tA)) * (ev.ate - ev.de); const flip = t > ev.tA && t < ev.tB ? 1 - (frac % 1) : 0;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(p[0], p[1]); ctx.scale(pop * S, pop * S); ctx.rotate(3 * D2R);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#fff'; rr(ctx, -w / 2, -h / 2, w, h, 18); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); rr(ctx, -w / 2, -h / 2, w, 92, 18); ctx.clip(); ctx.fillStyle = '#d63a2f'; ctx.fillRect(-w / 2, -h / 2, w, 92); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + 92); ctx.lineTo(w / 2, -h / 2 + 92); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `34px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ev.mes || 'APRIL 1500', 0, -h / 2 + 50);
  for (const rx of [-90, 90]) { ctx.fillStyle = '#444'; rr(ctx, rx - 9, -h / 2 - 22, 18, 42, 9); ctx.fill(); }
  ctx.save(); ctx.translate(0, 45); ctx.scale(1, 1 - 0.55 * flip);
  ctx.fillStyle = '#222'; ctx.font = `200px ${FONT_STAMP}`; ctx.fillText(String(n), 0, 6); ctx.restore();
  ctx.fillStyle = '#888'; ctx.font = `bold 24px ${FONT_SUB}`; ctx.fillText('DAY', 0, h / 2 - 32);
  ctx.restore();
  if (ev.rodape && t >= ev.tRodape) {
    const k = Ease.elastic(inv(ev.tRodape, ev.tRodape + 0.5, t));
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p[0], p[1] + offR); ctx.scale(k, k); ctx.rotate(-4 * D2R);
    ctx.font = `64px ${FONT_DISPLAY}`; const w2 = ctx.measureText(ev.rodape).width + 50;
    ctx.fillStyle = YELLOW; rr(ctx, -w2 / 2, -48, w2, 96, 14); ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ev.rodape, 0, 4); ctx.restore();
  }
}
function drawReview(ctx, L, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const kin = Ease.back(inv(ev.t0, ev.t0 + 0.4, t)), kout = Ease.in(inv(ev.t1 - 0.3, ev.t1, t));
  const w = 680, h = 380, p = placeV(L, posV(L, ev), w / 2 + 10, h / 2 + 10);
  ctx.save(); ctx.translate(p[0] + kout * (L.v ? 0 : 1200), p[1] + (1 - kin) * 700 + (L.v ? kout * 1400 : 0)); ctx.rotate(-2 * D2R);
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff'; rr(ctx, -w / 2, -h / 2, w, h, 26); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 6; ctx.strokeStyle = '#1c1c1c'; ctx.stroke();
  ctx.save(); rr(ctx, -w / 2, -h / 2, w, 60, 26); ctx.clip(); ctx.fillStyle = '#1f2a44'; ctx.fillRect(-w / 2, -h / 2, w, 60); ctx.restore();
  ctx.fillStyle = YELLOW; ctx.font = `28px ${FONT_DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('★', -w / 2 + 24, -h / 2 + 31);
  ctx.fillStyle = '#fff'; ctx.font = `24px ${FONT_DISPLAY}`; ctx.fillText(ev.app || 'EUROPE REVIEWS', -w / 2 + 62, -h / 2 + 32);
  // avatar com mini-Sam
  ctx.save(); ctx.translate(-w / 2 + 78, -h / 2 + 128);
  ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fillStyle = '#9fd3e6'; ctx.fill(); ctx.save(); ctx.clip();
  ctx.scale(0.42, 0.42); ctx.translate(0, 20);
  drawHeadAndFace(ctx, { expr: 'deadpan', look: 0, blink: 0, mouth: 0, lookY: 0 }, COSTUMES[ev.figurino || 'capitao'], 0);
  ctx.restore(); ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#111'; ctx.font = `bold 34px ${FONT_SUB}`; ctx.fillText(ev.nome || 'Pedro Á. Cabral', -w / 2 + 146, -h / 2 + 112);
  ctx.fillStyle = '#6b6b6b'; ctx.font = `bold 22px ${FONT_SUB}`; ctx.fillText(ev.sub || '1 review · visited April 1500', -w / 2 + 146, -h / 2 + 150);
  for (let i = 0; i < 5; i++) {
    const ts = ev.tEstrelas + i * 0.13; const k = t >= ts ? Ease.elastic(inv(ts, ts + 0.45, t)) : 0;
    ctx.save(); ctx.translate(-w / 2 + 50 + i * 58, -h / 2 + 214); ctx.scale(k, k);
    ctx.fillStyle = i < ev.estrelas ? '#f5b301' : '#d3d3d3'; star(ctx, 0, 0, 26); ctx.lineWidth = 3; ctx.strokeStyle = i < ev.estrelas ? '#8a5f00' : '#9a9a9a'; ctx.stroke(); ctx.restore();
  }
  ctx.font = `bold 44px ${FONT_SUB}`; ctx.fillStyle = '#151515';
  (ev.frases || []).forEach((f, i) => { if (t < f[1]) return; const k = Ease.out(inv(f[1], f[1] + 0.18, t));
    ctx.globalAlpha = k; ctx.fillText(f[0], -w / 2 + 40 + (1 - k) * 30, -h / 2 + 276 + i * 58); ctx.globalAlpha = 1; });
  ctx.restore();
}
function drawSign(ctx, L, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const d = t - ev.t0, S = L.v ? 0.9 : 1, R = 170 * Math.SQRT2 * S;
  let p = posV(L, ev);
  if (L.v) { const X = placeV(L, [p[0], -40 + S * (p[1] + 40)], R, R); p = [X[0], (X[1] + 40) / S - 40]; }
  const drop = Ease.back(clamp(d / 0.38, 0, 1));
  const y = lerp(-420, p[1], drop), ang = d > 0.3 ? 20 * Math.exp(-2.3 * (d - 0.3)) * Math.cos(8 * (d - 0.3)) : -8;
  const out = Ease.in(inv(ev.t1 - 0.25, ev.t1, t));
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(p[0], -40); ctx.rotate(ang * D2R); ctx.scale(S, S);
  const cy = y + 40, s = 170;
  ctx.strokeStyle = '#555'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-60, cy - s * 0.72); ctx.moveTo(60, 0); ctx.lineTo(60, cy - s * 0.72); ctx.stroke();
  ctx.translate(0, cy); ctx.rotate(45 * D2R);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#f28a1c'; rr(ctx, -s, -s, 2 * s, 2 * s, 22); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; rr(ctx, -s + 18, -s + 18, 2 * s - 36, 2 * s - 36, 14); ctx.stroke();
  ctx.rotate(-45 * D2R); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `62px ${FONT_DISPLAY}`; ctx.fillText(ev.txt || 'DETOUR', 0, -18);
  ctx.font = `90px ${FONT_DISPLAY}`; ctx.fillText(ev.seta || '→', 0, 60);
  ctx.restore();
}
function hookBox(ctx, L, ev) {
  const lines = String(ev.txt || '').toUpperCase().split('\n'); let fs = ev.tam || (L.v ? 104 : 88);
  ctx.save(); ctx.font = `${fs}px ${FONT_STAMP}`;
  const maxW = L.v ? SAFE_V.x1 - SAFE_V.x0 - 40 : 1500; let widest = Math.max(...lines.map(l => ctx.measureText(l).width)); ctx.restore();
  if (widest > maxW) { fs *= maxW / widest; widest = maxW; }
  const cx = L.v ? 510 : L.W / 2, cy = ev.y || (L.v ? 520 : 200), hh = lines.length * fs * 1.04 / 2 + fs * 0.15;
  return { lines, fs, cx, cy, box: [cx - widest / 2 - 20, cy - hh, cx + widest / 2 + 20, cy + hh] };
}
function drawHook(ctx, L, ev, t) {
  const a = vis(t, ev.t0 || 0, ev.t1 || 2.8, 0.1, 0.25); if (a <= 0) return;
  const { lines, fs, cx, cy } = hookBox(ctx, L, ev);
  const dest = new Set((ev.destaque || []).map(w => String(w).toUpperCase().replace(/[^A-Z0-9']/g, '')));
  ctx.save(); ctx.font = `${fs}px ${FONT_STAMP}`;
  const kin = Ease.back(inv(ev.t0 || 0, (ev.t0 || 0) + 0.35, t));
  ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate((-2.5 + Math.sin((t - (ev.t0 || 0)) * 3.2) * 0.7) * D2R); ctx.scale(0.72 + 0.28 * kin, 0.72 + 0.28 * kin);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const sp = ctx.measureText(' ').width;
  lines.forEach((ln, i) => {
    const ws = ln.split(' '), wd = ws.map(w => ctx.measureText(w).width), tot = wd.reduce((x, v) => x + v, 0) + sp * (ws.length - 1);
    let x = -tot / 2; const y = (i - (lines.length - 1) / 2) * fs * 1.04;
    ws.forEach((w, j) => { ctx.lineWidth = fs * 0.2; ctx.strokeStyle = INK; ctx.strokeText(w, x, y);
      ctx.fillStyle = dest.has(w.replace(/[^A-Z0-9']/g, '')) ? YELLOW : '#ffffff'; ctx.fillText(w, x, y); x += wd[j] + sp; });
  });
  ctx.restore();
}
function drawGodRays(ctx, L, ev, t) {
  const a = vis(t, ev.t0, ev.t1, 0.35, 0.45); if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const ang = (18 + i * 9 + Math.sin(t * 0.7 + i) * 2) * D2R, wid = 0.035 + 0.02 * hash(i);
    const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * 1400, Math.sin(ang) * 1400);
    g.addColorStop(0, `rgba(255,236,170,${0.38 * a})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L.v ? 200 : 380, -40);
    ctx.lineTo((L.v ? 200 : 380) + Math.cos(ang - wid) * 2000, -40 + Math.sin(ang - wid) * 2000);
    ctx.lineTo((L.v ? 200 : 380) + Math.cos(ang + wid) * 2000, -40 + Math.sin(ang + wid) * 2000); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
/* efeitos no mundo (seguem a câmera) */
function drawSymbolAt(ctx, x, y, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const k = Ease.elastic(inv(ev.t0, ev.t0 + 0.5, t)) * (1 - Ease.in(inv(ev.t1 - 0.15, ev.t1, t)));
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin((t - ev.t0) * 9) * 0.12); ctx.scale(k, k);
  ctx.font = `${ev.tam || 130}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 16; ctx.strokeStyle = '#fff'; ctx.strokeText(ev.txt, 0, 0); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(ev.txt, 0, 0);
  ctx.fillStyle = ev.cor || INK; ctx.fillText(ev.txt, 0, 0); ctx.restore();
}
function drawSparkle(ctx, ev, t) {
  if (t < ev.t || t > ev.t + 0.7) return; const d = (t - ev.t) / 0.7, k = Math.sin(Math.PI * d);
  ctx.save(); ctx.translate(ev.x, ev.y); ctx.rotate(d * 1.5); ctx.scale(k, k);
  ctx.fillStyle = '#fffbe0'; ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 4; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, r = i % 2 ? 14 : 58; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function drawDust(ctx, ev, t) {
  const d = t - ev.t; if (d < 0 || d > 1.1) return;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * (0.1 + 0.8 * hash(i + 3)), sp = 60 + 120 * hash(i + 9);
    const x = ev.x + Math.cos(a) * sp * Math.sqrt(d) * 1.4 - 40 * d, y = ev.y - 30 + Math.sin(a) * sp * Math.sqrt(d) * 0.8;
    const r = (34 + 28 * hash(i + 1)) * (0.6 + d);
    ctx.fillStyle = `rgba(222,200,160,${0.85 * (1 - d / 1.1)})`; ctx.strokeStyle = `rgba(120,95,60,${0.6 * (1 - d / 1.1)})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  }
}
function drawSpeedLines(ctx, x0, x1, y, t, alpha) {
  ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.85 * alpha})`; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const yy = y - 60 - i * 52 - hash(i) * 20, len = (x1 - x0) * (0.4 + 0.6 * hash(i + 4));
    ctx.lineWidth = 5 + 4 * hash(i + 2); ctx.beginPath(); ctx.moveTo(x1 - 120, yy); ctx.lineTo(x1 - 120 - len, yy); ctx.stroke(); }
  ctx.restore();
}
function drawFlyingMap(ctx, st, d) {
  const x = st.x - 40 - d * 520, y = st.y - 260 - d * 680 + d * d * 520;
  ctx.save(); ctx.translate(x, y); drawMapProp(ctx, 150, 100, d * 900); ctx.restore();
}

/* ---------------- CÂMERA ---------------- */

/* ---------------- v7: CARTÕES DE SAÚDE ---------------- */
const C_RISCO = '#e5393f', C_CUIDADO = '#22b36b', C_FATO = '#16a5c7';
function wrapLines(ctx, txt, maxW) {
  const out = [];
  for (const para of String(txt).split('\n')) { let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) { const tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > maxW && cur) { out.push(cur); cur = w; } else cur = tst; }
    out.push(cur); }
  return out;
}
function badge(ctx, kind, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = r * 0.16; ctx.strokeStyle = INK;
  if (kind === 'alerta') { ctx.fillStyle = YELLOW; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 1.05, r * 0.78); ctx.lineTo(-r * 1.05, r * 0.78); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `${r * 1.2}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, r * 0.18); }
  else { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
    if (kind === 'cuidado') { ctx.strokeStyle = C_CUIDADO; ctx.lineWidth = r * 0.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.45, 0); ctx.lineTo(-r * 0.1, r * 0.38); ctx.lineTo(r * 0.5, -r * 0.4); ctx.stroke(); }
    else { ctx.fillStyle = C_FATO; ctx.font = `${r * 1.25}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('i', 0, r * 0.08); } }
  ctx.restore();
}
// alerta = risco à saúde · cuidado = o que fazer · fato = curiosidade com fonte
function drawHealthCard(ctx, L, ev, t, kind) {
  if (t < ev.t0 || t > ev.t1) return;
  const kin = Ease.back(inv(ev.t0, ev.t0 + 0.42, t)), kout = 1 - Ease.in(inv(ev.t1 - 0.22, ev.t1, t)), k = kin * kout; if (k <= 0) return;
  const cor = kind === 'alerta' ? C_RISCO : kind === 'cuidado' ? C_CUIDADO : C_FATO;
  const titulo = ev.titulo || (kind === 'alerta' ? 'HEALTH RISK' : kind === 'cuidado' ? 'DO THIS' : 'FACT');
  const fs = (ev.tam || 50) * (L.v ? 1.04 : 1), maxW = L.v ? 700 : 720;
  ctx.save(); ctx.font = `${fs}px ${FONT_DISPLAY}`;
  const lines = wrapLines(ctx, ev.txt || '', maxW);
  const tw = Math.max(...lines.map(q => ctx.measureText(q).width)), bandH = fs * 1.35;
  ctx.font = `${fs * 0.74}px ${FONT_DISPLAY}`; const titW = ctx.measureText(titulo).width + fs * 2.2;
  const w = Math.max(tw + fs * 1.3, titW + fs * 0.6), h = bandH + lines.length * fs * 1.16 + fs * 0.78;
  const p = placeV(L, posV(L, ev, [1400, 330]), w / 2 + 12, h / 2 + 12);
  const sh = kind === 'alerta' ? Math.sin((t - ev.t0) * 70) * 7 * Math.max(0, 1 - (t - ev.t0) / 0.4) : 0;
  ctx.translate(p[0] + sh, p[1]); ctx.rotate((ev.rot !== undefined ? ev.rot : kind === 'alerta' ? -1.6 : 1.4) * D2R + Math.sin((t - ev.t0) * 2.1) * 0.012); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff'; rr(ctx, -w / 2, -h / 2, w, h, 20); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, 20); ctx.clip(); ctx.fillStyle = cor; ctx.fillRect(-w / 2, -h / 2, w, bandH);
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; for (let x = -w / 2 - bandH; x < w / 2; x += fs * 0.9) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + bandH); ctx.lineTo(x + bandH * 0.6, -h / 2); ctx.lineTo(x + bandH * 0.6 + fs * 0.3, -h / 2); ctx.lineTo(x + fs * 0.3, -h / 2 + bandH); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = 7; ctx.strokeStyle = INK; rr(ctx, -w / 2, -h / 2, w, h, 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + bandH); ctx.lineTo(w / 2, -h / 2 + bandH); ctx.lineWidth = 5; ctx.stroke();
  badge(ctx, kind, -w / 2 + fs * 0.95, -h / 2 + bandH / 2, fs * 0.46);
  ctx.fillStyle = '#ffffff'; ctx.font = `${fs * 0.74}px ${FONT_DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(titulo, -w / 2 + fs * 1.75, -h / 2 + bandH / 2 + 2); ctx.fillText(titulo, -w / 2 + fs * 1.75, -h / 2 + bandH / 2 + 2);
  ctx.fillStyle = INK; ctx.font = `${fs}px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
  lines.forEach((q, i) => ctx.fillText(q, 0, -h / 2 + bandH + fs * 0.42 + (i + 0.5) * fs * 1.16));
  if (ev.fonte) { ctx.font = `bold ${fs * 0.34}px ${FONT_SUB}`; ctx.fillStyle = '#6b7078'; ctx.fillText('Source: ' + ev.fonte, 0, h / 2 - fs * 0.32); }
  ctx.restore();
}
function fmtNum(n, casas) { const s = Number(n).toFixed(casas || 0); const [a, b] = s.split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : ''); }
// contador gigante: {"tipo":"numero","de":0,"ate":25,"sufixo":" TRILLION","txt":"red blood cells in your body"}
function drawCounter(ctx, L, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const kin = Ease.back(inv(ev.t0, ev.t0 + 0.35, t)), kout = 1 - Ease.in(inv(ev.t1 - 0.2, ev.t1, t)), k = kin * kout; if (k <= 0) return;
  const cnt = Ease.out(inv(ev.t0 + 0.1, ev.t0 + 0.1 + (ev.contagem || 1.1), t)), val = lerp(ev.de || 0, ev.ate || 0, cnt);
  const big = (ev.prefixo || '') + fmtNum(cnt >= 1 ? ev.ate : val, ev.casas) + (ev.sufixo || '');
  const fs = (ev.tam || 170) * (L.v ? 1.05 : 1);
  ctx.save(); ctx.font = `${fs}px ${FONT_STAMP}`; let bw = ctx.measureText(big).width; let sc = 1;
  const lim = L.v ? (SAFE_V.x1 - SAFE_V.x0 - 40) : 1500; if (bw > lim) sc = lim / bw;
  const lfs = fs * (L.v ? 0.36 : 0.3); ctx.font = `${lfs}px ${FONT_DISPLAY}`; const lines = ev.txt ? wrapLines(ctx, ev.txt, L.v ? 780 : 1100) : [];
  const h = fs * sc * 1.05 + lines.length * lfs * 1.2;
  const p = placeV(L, posV(L, ev, [1180, 360]), Math.min(bw * sc, lim) / 2 + 20, h / 2 + 20);
  ctx.translate(p[0], p[1]); ctx.scale(k, k); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${fs * sc}px ${FONT_STAMP}`; ctx.lineJoin = 'round'; ctx.lineWidth = fs * sc * 0.11; ctx.strokeStyle = INK;
  const y0 = -h / 2 + fs * sc * 0.5; ctx.strokeText(big, 0, y0); ctx.fillStyle = ev.cor || YELLOW; ctx.fillText(big, 0, y0);
  ctx.font = `${lfs}px ${FONT_DISPLAY}`; ctx.lineWidth = lfs * 0.17; ctx.fillStyle = '#ffffff';
  lines.forEach((q, i) => { const yy = y0 + fs * sc * 0.62 + (i + 0.5) * lfs * 1.2; ctx.strokeText(q, 0, yy); ctx.fillText(q, 0, yy); });
  ctx.restore();
}
// lista que vai marcando: {"tipo":"lista","titulo":"TONIGHT","estilo":"cuidado","itens":[{"txt":"…","t":12.3}]}
function drawChecklist(ctx, L, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const a = vis(t, ev.t0, ev.t1, 0.3, 0.25); if (a <= 0) return;
  const risco = ev.estilo === 'risco', cor = risco ? C_RISCO : C_CUIDADO, fs = (ev.tam || 44) * (L.v ? 1.02 : 1);
  ctx.save(); ctx.font = `${fs}px ${FONT_DISPLAY}`;
  const itens = (ev.itens || []).map(it => typeof it === 'string' ? { txt: it, t: ev.t0 } : it);
  const lines = itens.map(it => wrapLines(ctx, it.txt, L.v ? 640 : 700));
  const rows = lines.reduce((n, l) => n + l.length, 0), titH = ev.titulo ? fs * 1.4 : 0;
  const w = Math.max(...lines.flat().map(q => ctx.measureText(q).width)) + fs * 2.6, h = titH + rows * fs * 1.2 + itens.length * fs * 0.35 + fs * 0.7;
  const p = placeV(L, posV(L, ev, [1400, 420]), w / 2 + 12, h / 2 + 12);
  ctx.globalAlpha = a; ctx.translate(p[0] - (1 - Ease.out(inv(ev.t0, ev.t0 + 0.35, t))) * 60, p[1]);
  ctx.shadowColor = 'rgba(0,0,0,0.38)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 9; ctx.fillStyle = '#ffffff'; rr(ctx, -w / 2, -h / 2, w, h, 18); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
  let y = -h / 2 + fs * 0.5;
  if (ev.titulo) { ctx.fillStyle = cor; rr(ctx, -w / 2, -h / 2, w, titH, 18); ctx.fill(); ctx.fillRect(-w / 2, -h / 2 + titH / 2, w, titH / 2); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + titH); ctx.lineTo(w / 2, -h / 2 + titH); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ev.titulo, 0, -h / 2 + titH / 2 + 2); y = -h / 2 + titH + fs * 0.45; }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  itens.forEach((it, i) => {
    const ki = Ease.back(inv(it.t, it.t + 0.3, t)), on = t >= it.t;
    const bx = -w / 2 + fs * 0.95, by = y + fs * 0.6;
    ctx.save(); ctx.globalAlpha = a * (on ? 1 : 0.28); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.fillStyle = on ? cor : '#ffffff'; rr(ctx, bx - fs * 0.38, by - fs * 0.38, fs * 0.76, fs * 0.76, 8); ctx.fill(); ctx.stroke();
    if (on) { ctx.translate(bx, by); ctx.scale(ki, ki); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = fs * 0.13; ctx.lineCap = 'round'; ctx.beginPath();
      if (risco) { ctx.moveTo(-fs * 0.18, -fs * 0.18); ctx.lineTo(fs * 0.18, fs * 0.18); ctx.moveTo(fs * 0.18, -fs * 0.18); ctx.lineTo(-fs * 0.18, fs * 0.18); }
      else { ctx.moveTo(-fs * 0.2, 0); ctx.lineTo(-fs * 0.05, fs * 0.16); ctx.lineTo(fs * 0.22, -fs * 0.18); } ctx.stroke(); }
    ctx.restore();
    ctx.globalAlpha = a * (on ? 1 : 0.28); ctx.fillStyle = INK;
    lines[i].forEach((q, j) => ctx.fillText(q, bx + fs * 0.7, y + fs * 0.6 + j * fs * 1.2));
    y += lines[i].length * fs * 1.2 + fs * 0.35;
  });
  ctx.restore();
}
// rótulo com seta para um ponto do mundo (ou uma célula do cenário 3D, ou o Sam)
function drawLabel(ctx, L, ev, t, alvo) {
  if (t < ev.t0 || t > ev.t1 || !alvo) return;
  const a = vis(t, ev.t0, ev.t1, 0.2, 0.25); if (a <= 0) return;
  const fs = (ev.tam || 44) * (L.v ? 1.0 : 1); ctx.save(); ctx.font = `${fs}px ${FONT_DISPLAY}`;
  const lines = wrapLines(ctx, ev.txt || '', L.v ? 600 : 620), w = Math.max(...lines.map(q => ctx.measureText(q).width)) + fs * 1.1, h = lines.length * fs * 1.15 + fs * 0.6;
  const def = ev.pos || [alvo[0] + (alvo[0] > (L.v ? 540 : 960) ? -330 : 330) * (L.v ? 0.75 : 1), alvo[1] - 230];
  const p = L.v ? placeV(L, ev.pv || [clamp(def[0], 72 + w / 2, 948 - w / 2), clamp(def[1], 262 + h / 2, 1180 - h / 2)], w / 2 + 10, h / 2 + 10) : [clamp(def[0], w / 2 + 40, 1880 - w / 2), clamp(def[1], h / 2 + 40, 1040 - h / 2)];
  const kl = Ease.out(inv(ev.t0, ev.t0 + 0.35, t)), kp = Ease.back(inv(ev.t0 + 0.12, ev.t0 + 0.5, t));
  const ex = clamp(alvo[0], p[0] - w / 2, p[0] + w / 2), ey = clamp(alvo[1], p[1] - h / 2, p[1] + h / 2);
  ctx.globalAlpha = a; ctx.lineCap = 'round';
  const mx = lerp(ex, alvo[0], kl), my = lerp(ey, alvo[1], kl);
  ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(mx, my); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke();
  if (kl > 0.95) { const pr = 14 + 6 * Math.sin((t - ev.t0) * 6); ctx.fillStyle = YELLOW; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(alvo[0], alvo[1], 11, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(alvo[0], alvo[1], pr + 8, 0, TAU); ctx.stroke(); ctx.globalAlpha = a; }
  ctx.translate(p[0], p[1]); ctx.scale(kp, kp);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; ctx.fillStyle = ev.cor || '#ffffff'; rr(ctx, -w / 2, -h / 2, w, h, h / 2.4); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = ev.corTexto || INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((q, i) => ctx.fillText(q, 0, (i - (lines.length - 1) / 2) * fs * 1.15 + fs * 0.04));
  ctx.restore();
}
// aviso médico discreto (vai também na descrição)
function drawDisclaimer(ctx, L, ev, t) {
  const a = vis(t, ev.t0, ev.t1, 0.4, 0.5); if (a <= 0) return;
  const txt = ev.txt || 'For education only — not medical advice. Talk to a doctor about your health.';
  const fs = L.v ? 27 : 26; ctx.save(); ctx.globalAlpha = a * 0.92; ctx.font = `bold ${fs}px ${FONT_SUB}`;
  const lines = L.v ? wrapLines(ctx, txt, 760) : [txt], w = Math.max(...lines.map(q => ctx.measureText(q).width)) + 70, h = lines.length * fs * 1.3 + 20;
  const x = L.v ? (L.W - w) / 2 : 40, y = L.v ? 1352 : 40;   // no 9:16 fica logo abaixo da legenda, longe do rosto do Sam
  ctx.fillStyle = 'rgba(10,14,20,0.72)'; rr(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.beginPath(); ctx.arc(x + 30, y + h / 2, 12, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.font = `bold ${fs * 0.75}px ${FONT_SUB}`; ctx.textAlign = 'center'; ctx.fillText('i', x + 30, y + h / 2 + 1);
  ctx.font = `bold ${fs}px ${FONT_SUB}`; ctx.textAlign = 'left'; lines.forEach((q, i) => ctx.fillText(q, x + 52, y + 10 + (i + 0.5) * fs * 1.3));
  ctx.restore();
}
function drawCover(g, src, x, y, w, h) {
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height; if (!sw || !sh) return;
  const k = Math.max(w / sw, h / sh); g.drawImage(src, x + (w - sw * k) / 2, y + (h - sh * k) / 2, sw * k, sh * k);
}

function camAt(scene, t, vert) {
  const keys = (scene.camera && scene.camera.chaves) || [{ t: scene.inicio, zoom: 1.04, fx: 0.5, fy: 0.55 }];
  let prev = keys[0], cur = keys[0];
  for (const k of keys) { if (k.t <= t) { prev = cur === k ? prev : cur; cur = k; } }
  // interpolação: cada chave "chega" no seu t a partir da anterior (a menos que seja corte)
  let idx = 0; for (let i = 0; i < keys.length; i++) if (keys[i].t <= t) idx = i;
  const k0 = keys[idx], k1 = keys[idx + 1];
  const gz = k => (vert && k.zoomv !== undefined ? k.zoomv : k.zoom), gx = k => (vert && k.fxv !== undefined ? k.fxv : k.fx), gy = k => (vert && k.fyv !== undefined ? k.fyv : k.fy);
  let z = gz(k0), fx = gx(k0), fy = gy(k0);
  if (k1 && !k1.corte) { const e = (k1.ease === 'inOut' ? Ease.inOut : Ease.linear)(inv(k0.t, k1.t, t)); z = lerp(gz(k0), gz(k1), e); fx = lerp(gx(k0), gx(k1), e); fy = lerp(gy(k0), gy(k1), e); }
  let rot = 0, shx = 0, shy = 0;
  const cam = scene.camera || {};
  if (cam.balanco) rot += cam.balanco * Math.sin(t * TAU / 4.2);
  for (const e of (cam.eventos || [])) {
    if (e.tipo === 'balanco_forte') { const a = vis(t, e.t0, e.t1, 0.5, 0.6); rot += a * (e.amp || 2.5) * Math.sin((t - e.t0) * TAU / 2.4); }
    if (e.tipo === 'tremer') { const d = t - e.t; if (d >= 0 && d < (e.dur || 0.35)) { const f = 1 - d / (e.dur || 0.35); shx += Math.sin(d * 87) * (e.amp || 16) * f; shy += Math.cos(d * 71) * (e.amp || 16) * 0.6 * f; } }
    if (e.tipo === 'punch') { const d = t - e.t; if (d >= 0) { const up = Ease.out(clamp(d / 0.12, 0, 1)), down = e.dur ? 1 - Ease.inOut(inv(e.t + e.dur, e.t + e.dur + 0.3, t)) : 1; z *= 1 + (e.z || 0.15) * up * down; } }
  }
  const fixa = vert && (k0.fxv !== undefined || (k1 && k1.fxv !== undefined));
  return { z, fx, fy, rot, shx, shy, fixa };
}

/* ---------------- MOTOR ---------------- */
function create(canvas, episode, assets) {
  const fmt = episode.formato || '16x9';
  const L = fmt === '9x16' ? { W: 1080, H: 1920, v: true } : { W: 1920, H: 1080, v: false };
  canvas.width = L.W; canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const world = document.createElement('canvas'); world.width = L.W; world.height = L.H; const wctx = world.getContext('2d');
  const world2 = document.createElement('canvas'); world2.width = L.W; world2.height = L.H; const wctx2 = world2.getContext('2d');
  for (const [nm, spec] of Object.entries(episode.figurinos || {})) COSTUMES[nm] = makeCostume(spec);
  const fps = episode.fps || 30;
  const boca = assets.boca || null;
  const mouthAt = t => { if (!boca) return 0; const i = Math.floor(t * fps); return boca[clamp(i, 0, boca.length - 1)] || 0; };
  const scenes = episode.cenas.slice().sort((a, b) => a.inicio - b.inicio);
  const subs = buildSubtitleBlocks(episode.legenda || [], L.v);
  const warnings = validate(episode);
  const S3 = (episode.sam3d === false || !global.Sam3D) ? null : global.Sam3D.create({ estilo: episode.estilo3d || assets.estilo3d || 'A', qualidade: assets.qualidade });
  const videos = assets.videos || {};

  function renderWorld(g, scene, t) {
    const cam = camAt(scene, t, L.v);
    const st = scene.sam ? samState(scene.sam, t, mouthAt) : null; VIEW.head = null;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, L.W, L.H);
    let base = L.v ? (L.H / 1080) : (L.W / 1920);
    const extra = cam.rot ? 1.035 : 1;
    const z = base * cam.z * extra;
    const F = [cam.fx * 1920, cam.fy * 1080];
    let cx = L.W / 2, cy = L.H / 2;
    if (!L.v) { cx = F[0] * L.W / 1920; cy = F[1] * L.H / 1080; }
    g.translate(cx + cam.shx, cy + cam.shy); g.rotate(cam.rot * D2R); g.scale(z, z);
    let Fx = F[0], Fy = F[1];
    if (L.v) {
      // segue o Sam: mantém o Sam entre x 380 e 700 da tela (longe da coluna de botões), salvo se a cena fixou fxv
      if (st && st.visible && !st.peek && !cam.fixa && (scene.camera || {}).seguir !== false) {
        const sx = (st.x - Fx) * z + L.W / 2;
        if (sx < 380) Fx = st.x + (L.W / 2 - 380) / z; else if (sx > 700) Fx = st.x - (700 - L.W / 2) / z;
      }
      const half = (L.W / 2) / z; Fx = clamp(Fx, half, 1920 - half); const halfH = (L.H / 2) / z; Fy = clamp(Fy, halfH, 1080 - halfH);
    }
    g.translate(-Fx, -Fy);
    if (L.v && st && st.visible && !st.peek) { // caixa do rosto (testa ao queixo) em coordenadas de tela
      const r = RIG.headR * st.s * z, hx = L.W / 2 + (st.x - Fx) * z, hy = L.H / 2 + (st.y + HEAD_CY * st.s - Fy) * z;
      VIEW.head = [hx - r * 1.05, hy - r * 0.85, hx + r * 1.05, hy + r * 0.8];
    }
    VIEW.x0 = Fx - (L.v ? L.W / 2 : cx) / z; VIEW.x1 = Fx + (L.v ? L.W / 2 : (L.W - cx)) / z; VIEW.v = L.v;
    VIEW.m = g.getTransform();
    if (st && st.visible && !st.peek) { VIEW.samHead = [st.x, st.y - st.jump + HEAD_CY * st.s]; const P = st.pose;
      VIEW.samHand = { R: [st.x + (RIG.shoulderX + Math.sin(P.R[0] * D2R) * RIG.upper + Math.sin((P.R[0] + P.R[1]) * D2R) * (RIG.fore + 22)) * st.s, st.y - st.jump + (RIG.shoulderY + Math.cos(P.R[0] * D2R) * RIG.upper + Math.cos((P.R[0] + P.R[1]) * D2R) * (RIG.fore + 22)) * st.s],
        L: [st.x - (RIG.shoulderX + Math.sin(P.L[0] * D2R) * RIG.upper + Math.sin((P.L[0] + P.L[1]) * D2R) * (RIG.fore + 22)) * st.s, st.y - st.jump + (RIG.shoulderY + Math.cos(P.L[0] * D2R) * RIG.upper + Math.cos((P.L[0] + P.L[1]) * D2R) * (RIG.fore + 22)) * st.s] }; }
    else { VIEW.samHead = null; VIEW.samHand = null; }
    const img = assets.images[scene.fundo], vid = scene.video && videos[scene.video];
    if (scene.cena3d && S3) {
      const m = g.getTransform(), iv = m.inverse(), zz = Math.hypot(m.a, m.b) || 1;
      const pts = [[0, 0], [L.W, 0], [0, L.H], [L.W, L.H]].map(([x, y]) => iv.transformPoint(new DOMPoint(x, y)));
      const x0 = Math.min(...pts.map(q => q.x)), x1 = Math.max(...pts.map(q => q.x)), y0 = Math.min(...pts.map(q => q.y)), y1 = Math.max(...pts.map(q => q.y));
      S3.drawSet(g, scene.cena3d, t, { x0, y0, x1, y1, pw: (x1 - x0) * zz, ph: (y1 - y0) * zz, vertical: L.v }, assets);
    } else if (vid) { g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080); drawCover(g, vid, 0, 0, 1920, 1080); }
    else if (img) g.drawImage(img, 0, 0, 1920, 1080); else { const gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#1d5f77'); gr.addColorStop(1, '#0a1e2a'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); }
    // efeitos de mundo atrás do Sam
    for (const ev of (scene.efeitos || [])) {
      if (ev.tipo === 'poeira') drawDust(g, ev, t);
      if (ev.tipo === 'brilho') drawSparkle(g, ev, t);
    }
    if (st) {
      if (st.speed > 0) drawSpeedLines(g, st.speedX0 !== undefined ? st.speedX0 : scene.sam.x, Math.min(st.x, 1920 + 300), st.y, t, st.speed);
      if (S3) S3.drawSam(g, st, { luz: scene.luz || (scene.cena3d && S3.setLight(scene.cena3d)) || 'neutro', prancha: st.prancha, sombra: scene.sombra, vertical: L.v, v0: VIEW.x0, v1: VIEW.x1 });
      else drawSam(g, st);
      if (st.flyMap !== null) drawFlyingMap(g, st, st.flyMap);
      for (const ev of (scene.efeitos || [])) if (ev.tipo === 'simbolo') drawSymbolAt(g, st.x + (ev.dx || 70) * st.s, st.y - (ev.dy || 540) * st.s - st.jump, ev, t);
    }
    g.restore();
  }

  function renderAt(t) {
    // cena atual + transição
    let i = 0; for (let k = 0; k < scenes.length; k++) if (scenes[k].inicio <= t) i = k;
    const sc = scenes[i], tr = sc.entrada || { tipo: 'corte', dur: 0 };
    renderWorld(wctx, sc, t); const headBox = VIEW.head, worldM = VIEW.m, samHead = VIEW.samHead, samHand = VIEW.samHand;
    const toScreen = pt => { if (!pt) return null; const q = worldM.transformPoint(new DOMPoint(pt[0], pt[1])); return [q.x, q.y]; };
    const alvoDe = ev => { const a = ev.alvo; if (Array.isArray(a)) return toScreen(a); if (a === 'sam' || a === 'cabeca') return toScreen(samHead && [samHead[0], samHead[1] - 40]);
      if (a === 'mao' || a === 'mao_R' || a === 'mao_L') return toScreen(samHand && samHand[a === 'mao_L' ? 'L' : 'R']);
      if (typeof a === 'string' && S3 && sc.cena3d) return toScreen(S3.anchor(sc.cena3d, a, t, assets, L.v)); return null; };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (i > 0 && tr.tipo !== 'corte' && t < sc.inicio + (tr.dur || 0.35)) {
      const k = inv(sc.inicio, sc.inicio + (tr.dur || 0.35), t);
      renderWorld(wctx2, scenes[i - 1], t);
      if (tr.tipo === 'whip') {
        const e = Ease.inOut(k), off = e * L.W;
        ctx.drawImage(world2, -off, 0); ctx.drawImage(world, L.W - off, 0);
        const sa = Math.sin(Math.PI * k);
        ctx.save(); ctx.globalAlpha = 0.55 * sa; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
        for (let j = 0; j < 14; j++) { const yy = L.H * (0.05 + 0.9 * hash(j + 1)), len = L.W * (0.25 + 0.4 * hash(j + 7)), xx = L.W - off - len * 0.5;
          ctx.lineWidth = 3 + 6 * hash(j + 3); ctx.beginPath(); ctx.moveTo(xx - len / 2, yy); ctx.lineTo(xx + len / 2, yy); ctx.stroke(); }
        ctx.restore();
      } else { ctx.drawImage(world2, 0, 0); ctx.globalAlpha = Ease.inOut(k); ctx.drawImage(world, 0, 0); ctx.globalAlpha = 1; }
    } else ctx.drawImage(world, 0, 0);
    // overlays de tela
    const fmtNome = L.v ? '9x16' : '16x9';
    const evs = (episode.eventos || []).filter(e => !e.so || e.so === fmtNome); // "so": "9x16" = só no vertical
    const ganchos = evs.filter(e => e.tipo === 'gancho');
    const adiar = ev => { // nome e mapa esperam o gancho sair da tela
      if (ev.tipo !== 'nome' && ev.tipo !== 'mapa') return ev;
      const g = ganchos.find(q => ev.t0 < (q.t1 || 2.8) && ev.t1 > (q.t0 || 0)); if (!g) return ev;
      const n = Object.assign({}, ev, { t0: Math.max(ev.t0, g.t1 || 2.8) }); return n.t1 - n.t0 >= 0.6 ? n : null;
    };
    const dtag = (episode.datas || []).filter(d => t >= d.t0 && t < d.t1).pop();
    OCC.length = 0;
    if (L.v) {
      if (dtag) { const b = dateTagBox(ctx, L, String(dtag.txt)); OCC.push([b.x - 8, b.y - 8, b.x + b.w + 8, b.y + b.h + 8]); }
      OCC.push([95, 1205, 915, 1335]); // faixa da legenda
      if (headBox) OCC.push(headBox);
      for (const e0 of evs) { const e = adiar(e0); if (!e) continue;
        if (e.tipo === 'nome' && t >= e.t0 && t <= e.t1) { const b = nameBox(ctx, L, e); OCC.push([b.x, b.y, b.x + b.w, b.y + b.h]); }
        if (e.tipo === 'mapa' && t >= e.t0 && t <= e.t1) { const b = mapBox(L); OCC.push([b.x, b.y, b.x + b.w + b.pad * 2, b.y + b.H]); }
        if (e.tipo === 'gancho' && t >= (e.t0 || 0) && t <= (e.t1 || 2.8)) OCC.push(hookBox(ctx, L, e).box); }
    }
    for (const ev0 of evs) {
      const ev = adiar(ev0); if (!ev) continue;
      switch (ev.tipo) {
        case 'raios': drawGodRays(ctx, L, ev, t); break;
        case 'mapa': drawMapCard(ctx, L, ev, t); break;
        case 'nome': drawLowerThird(ctx, L, ev, t); break;
        case 'cartao': drawPopCard(ctx, L, ev, t); break;
        case 'carimbo': drawStamp(ctx, L, ev, t); break;
        case 'calendario': drawCalendar(ctx, L, ev, t); break;
        case 'review': drawReview(ctx, L, ev, t); break;
        case 'placa': drawSign(ctx, L, ev, t); break;
        case 'gancho': drawHook(ctx, L, ev, t); break;
        case 'alerta': drawHealthCard(ctx, L, ev, t, 'alerta'); break;
        case 'cuidado': drawHealthCard(ctx, L, ev, t, 'cuidado'); break;
        case 'fato': drawHealthCard(ctx, L, ev, t, 'fato'); break;
        case 'numero': drawCounter(ctx, L, ev, t); break;
        case 'lista': drawChecklist(ctx, L, ev, t); break;
        case 'rotulo': if (t >= ev.t0 && t <= ev.t1) drawLabel(ctx, L, ev, t, alvoDe(ev)); break;
        case 'aviso': drawDisclaimer(ctx, L, ev, t); break;
      }
    }
    // etiqueta de data
    const dt = dtag;
    if (dt) { const pulse = dt.pulso ? Math.sin(Math.PI * clamp((t - dt.pulso) / 0.35, 0, 1)) : 0; drawDateTag(ctx, L, dt.txt, pulse); }
    drawSubtitles(ctx, L, subs, t);
    if (episode.fade_final) { const a = inv(episode.duracao - episode.fade_final, episode.duracao, t); if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, L.W, L.H); } }
  }
  return { renderAt, duration: episode.duracao, fps, L, warnings, subs, sam3d: !!S3 };
}


/* ================= v7: ROTEIRO → EPISÓDIO =================
   O roteiro não tem tempos: cada bloco tem a "fala" e o que acontece na tela, preso a uma PALAVRA da fala.
   Os tempos vêm do áudio da narração (alinhamento automático) ou, sem áudio, de uma estimativa de ~2,6 palavras/s. */
const SENT_END = /[.!?…]["'”’)\]]*$/, PHRASE_END = /[,;:—–]["'”’)\]]*$/;
const EVENT_TYPES = ['gancho', 'cartao', 'carimbo', 'placa', 'nome', 'review', 'calendario', 'raios', 'mapa', 'alerta', 'cuidado', 'fato', 'numero', 'lista', 'rotulo', 'aviso'];
const SFX_NAMES = ['whoosh', 'whoosh_leve', 'pop', 'ding', 'carimbo', 'alerta', 'tick', 'boing', 'coracao', 'scratch', 'plim', 'erro', 'sucesso', 'riser', 'impacto'];
const CENARIOS_3D = ['arteria', 'estudio'];
function normWord(w) { return String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, ''); }
function syllables(w) {
  let x = normWord(w).replace(/'/g, ''); if (!x) return 1;
  if (/^\d+$/.test(x)) return Math.max(2, Math.round(x.length * 1.6));
  if (x.length <= 3) return 1;
  x = x.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = x.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1);
}
function tokenize(fala) {
  const toks = [];
  for (const raw of String(fala || '').split(/\s+/).filter(Boolean)) { if (!/[A-Za-z0-9À-ÿ]/.test(raw)) { if (toks.length) toks[toks.length - 1] += (raw === '—' || raw === '–' ? ' —' : raw); continue; } toks.push(raw); }
  return toks;
}
function wordDur(w, ritmo) { return (0.11 + 0.17 * syllables(w)) / ritmo; }
function estimarPalavras(blocos, ritmo = 1) {
  let t = 0.45; const out = [];
  (blocos || []).forEach((b, bi) => {
    tokenize(b.fala).forEach((w, i) => { const d = wordDur(w, ritmo); out.push({ w, b: bi, i, t0: +t.toFixed(3), t1: +(t + d * 0.9).toFixed(3) }); t += d;
      if (SENT_END.test(w)) t += 0.42 / ritmo; else if (PHRASE_END.test(w)) t += 0.2 / ritmo; });
    t += 0.3 / ritmo;
  });
  return out;
}
// alinha as palavras ao áudio real: acha os trechos de fala entre pausas e decide (programação dinâmica) quais palavras
// cabem em cada trecho — pausas caem de preferência no fim de bloco, de frase ou na vírgula; dentro do trecho, tempo ∝ sílabas
function alinharPalavras(words, env, hz) {
  const n = env.length, W = words.length; if (!n || !W) return words;
  const srt = Float32Array.from(env).sort(), noise = srt[Math.floor(n * 0.05)] || 0, peak = srt[Math.floor(n * 0.99)] || 1e-3;
  const thr = noise + (peak - noise) * 0.06, sp = new Uint8Array(n);
  for (let i = 0; i < n; i++) sp[i] = env[i] > thr ? 1 : 0;
  const fill = (val, maxLen) => { let i = 0; while (i < n) { if (sp[i] === val) { let j = i; while (j < n && sp[j] === val) j++; if (j - i <= maxLen && i > 0 && j < n) for (let k = i; k < j; k++) sp[k] = 1 - val; i = j; } else i++; } };
  fill(0, Math.round(0.11 * hz)); fill(1, Math.round(0.05 * hz));
  let segs = []; for (let i = 0; i < n;) { if (sp[i]) { let j = i; while (j < n && sp[j]) j++; segs.push([i / hz, j / hz]); i = j; } else i++; }
  if (!segs.length) return words;
  while (segs.length > W) { let best = 1, gap = 1e9; for (let k = 1; k < segs.length; k++) { const g = segs[k][0] - segs[k - 1][1]; if (g < gap) { gap = g; best = k; } }
    segs[best - 1] = [segs[best - 1][0], segs[best][1]]; segs.splice(best, 1); }
  const m = segs.length, e = words.map(w => 0.11 + 0.17 * syllables(w.w)), pre = [0]; for (const x of e) pre.push(pre[pre.length - 1] + x);
  const D = segs.map(q => q[1] - q[0]), rate = D.reduce((a, b) => a + b, 0) / pre[W];
  const pen = words.map((w, i) => i === W - 1 ? 0 : (words[i + 1].b !== w.b ? 0 : SENT_END.test(w.w) ? 0.25 : PHRASE_END.test(w.w) ? 0.7 : 2.5));
  const MAXG = 60, INF = 1e18, dp = Array.from({ length: m + 1 }, () => new Float64Array(W + 1).fill(INF)), bk = Array.from({ length: m + 1 }, () => new Int32Array(W + 1));
  dp[0][0] = 0;
  for (let k = 1; k <= m; k++) for (let i = k; i <= W - (m - k); i++) for (let g = 1; g <= Math.min(MAXG, i - (k - 1)); g++) {
    const j = i - g, prev = dp[k - 1][j]; if (prev >= INF) continue;
    const r = Math.log(D[k - 1] / Math.max(1e-3, rate * (pre[i] - pre[j]))), c = prev + r * r + (k < m ? pen[i - 1] : 0);
    if (c < dp[k][i]) { dp[k][i] = c; bk[k][i] = j; } }
  if (dp[m][W] >= INF) return words;
  const cut = new Array(m + 1); cut[m] = W; for (let k = m; k > 0; k--) cut[k - 1] = bk[k][cut[k]];
  const out = words.map(w => Object.assign({}, w));
  for (let k = 0; k < m; k++) { const j0 = cut[k], j1 = cut[k + 1], [s0, s1] = segs[k], tot = pre[j1] - pre[j0];
    for (let q = j0; q < j1; q++) { out[q].t0 = +(s0 + (pre[q] - pre[j0]) / tot * (s1 - s0)).toFixed(3); out[q].t1 = +(s0 + (pre[q + 1] - pre[j0]) / tot * (s1 - s0)).toFixed(3); } }
  return out;
}
function envelope(ch, sr, hz = 100) { const hop = Math.round(sr / hz), n = Math.floor(ch.length / hop), e = new Float32Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let i = k * hop; i < (k + 1) * hop; i++) s += ch[i] * ch[i]; e[k] = Math.sqrt(s / hop); } return e; }
// boca sem áudio: abre e fecha por sílaba (para a prévia ficar viva antes da narração existir)
function bocaDePalavras(words, fps, dur) {
  const n = Math.ceil(dur * fps), out = new Array(n).fill(0);
  for (const w of words) { const syl = syllables(w.w), f0 = Math.floor(w.t0 * fps), f1 = Math.ceil(w.t1 * fps);
    for (let f = Math.max(0, f0); f < Math.min(n, f1); f++) { const ph = (f / fps - w.t0) / Math.max(0.05, w.t1 - w.t0); out[f] = Math.max(out[f], 0.15 + 0.7 * Math.abs(Math.sin(Math.PI * ph * syl))); } }
  return out;
}
const CAM_ZOOM = { geral: 1.0, medio: 1.12, perto: 1.35, rosto: 1.75 };
function compilarRoteiro(rot, palavras) {
  const warns = [], blocos = rot.blocos || [];
  if (!blocos.length) return { ep: null, warns: ['⚠ o roteiro não tem "blocos"'] };
  const words = palavras || estimarPalavras(blocos, rot.ritmo || 1);
  const byB = blocos.map(() => []); for (const w of words) if (byB[w.b]) byB[w.b].push(w);
  blocos.forEach((b, bi) => { if (!byB[bi].length) warns.push(`⚠ bloco ${bi + 1} sem "fala"`); });
  const bS = bi => (byB[bi][0] || { t0: 0 }).t0, bE = bi => (byB[bi].at(-1) || { t1: bS(bi) + 1 }).t1;
  const acha = (bi, palavra, n) => {
    if (palavra === undefined || palavra === null) return null;
    if (typeof palavra === 'number') return byB[bi][palavra] || null;
    const alvo = String(palavra).split(/\s+/).map(normWord).filter(Boolean); if (!alvo.length) return null;
    const ws = byB[bi], hits = [];
    for (const modo of ['igual', 'comeca']) { for (let i = 0; i + alvo.length <= ws.length; i++) {
      if (alvo.every((a, j) => modo === 'igual' ? normWord(ws[i + j].w) === a : normWord(ws[i + j].w).startsWith(a))) hits.push(ws[i]); } if (hits.length) break; }
    const h = hits[Math.max(0, (n || 1) - 1)];
    if (!h) warns.push(`⚠ bloco ${bi + 1}: a palavra "${palavra}" não está na fala`); return h || null;
  };
  const quando = (bi, o, padrao) => { const w = acha(bi, o.palavra, o.n); return w ? w.t0 : padrao; };
  const dur = +((words.at(-1) || { t1: 2 }).t1 + (rot.final ?? 1.5)).toFixed(2);
  const ep = { versao: '7.0', titulo: rot.titulo || 'Episódio', formato: rot.formato || '16x9', fps: rot.fps || 30, duracao: dur, audio: rot.voz || null,
    fade_final: 0.35, estilo3d: rot.estilo3d || 'A', datas: [], cenas: [], eventos: [], legenda: [], sfx: [], musica: rot.musica || null, roteiro: true };
  const auto = rot.sfx_auto !== false;
  let samAtual = Object.assign({ x: 520, chao: 1000, escala: 1.0, figurino: 'medico', pose: 'idle', expressao: 'deadpan', olhar: 0 }, rot.sam_padrao || {});
  let cena = null, cam = { zoom: 1.04, fx: 0.5, fy: 0.55 };
  const SAMK = ['pose', 'expressao', 'olhar', 'olharY', 'x', 'figurino', 'prancha', 'visivel', 'fala', 'prop', 'prop2', 'propMao'];
  blocos.forEach((b, bi) => {
    const t0 = bS(bi), t1 = bE(bi), tCena = Math.max(0, t0 - 0.12);
    if (b.cena || !cena) {
      const c = b.cena || { cenario: 'estudio' };
      if (c.cenario && !CENARIOS_3D.includes(c.cenario)) warns.push(`⚠ bloco ${bi + 1}: cenário "${c.cenario}" não existe (use ${CENARIOS_3D.join(', ')})`);
      cena = { id: c.id || `cena${ep.cenas.length + 1}`, inicio: ep.cenas.length ? +tCena.toFixed(3) : 0,
        entrada: b.transicao && b.transicao !== 'corte' ? { tipo: b.transicao, dur: b.transicao === 'whip' ? 0.3 : 0.4 } : { tipo: 'corte', dur: 0 }, camera: { chaves: [] } };
      if (c.cenario) cena.cena3d = Object.assign({}, c); if (c.fundo) cena.fundo = c.fundo; if (c.video) { cena.video = c.video; cena.video_inicio = c.video_inicio || 0; }
      if (c.luz) cena.luz = c.luz; if (c.sombra !== undefined) cena.sombra = c.sombra;
      samAtual.prancha = null; cena.sam = c.sam === false ? null : Object.assign({}, samAtual, c.sam || {}, { chaves: [], acoes: [] });
      if (c.sam && c.sam.x !== undefined) samAtual.x = c.sam.x;
      ep.cenas.push(cena); if (auto && ep.cenas.length > 1) ep.sfx.push([cena.entrada.tipo === 'whip' ? 'whoosh' : 'whoosh_leve', +Math.max(0, tCena - 0.1).toFixed(3), 0.55]);
      cam = { zoom: 1.04, fx: 0.5, fy: 0.55 };
    }
    // câmera do bloco
    const cv = b.camera; const kStart = Object.assign({ t: +Math.max(cena.inicio, t0 - 0.05).toFixed(3) }, cam);
    if (cv) {
      const tipo = typeof cv === 'string' ? cv : (cv.tipo || 'manual');
      const sx = (cena.sam ? samAtual.x : 960) / 1920, headY = ((samAtual.chao || 1000) + HEAD_CY * (samAtual.escala || 1)) / 1080;
      if (tipo === 'push' || tipo === 'pull') { cena.camera.chaves.push(kStart); cam = Object.assign({}, cam, { zoom: +(cam.zoom * (tipo === 'push' ? 1.12 : 1 / 1.12)).toFixed(3) }); cena.camera.chaves.push(Object.assign({ t: +t1.toFixed(3), ease: 'inOut' }, cam)); }
      else if (CAM_ZOOM[tipo]) { const kk = { geral: 0, medio: 0.4, perto: 0.75, rosto: 1 }[tipo]; cam = { zoom: CAM_ZOOM[tipo], fx: +lerp(0.5, sx, kk).toFixed(3), fy: +lerp(0.55, headY, kk).toFixed(3) };
        if (tipo === 'rosto' || tipo === 'perto') cam.fyv = +(headY + (tipo === 'rosto' ? 0.075 : 0.125)).toFixed(3); cena.camera.chaves.push(Object.assign({ t: kStart.t, corte: true }, cam)); }
      else if (tipo === 'punch' || tipo === 'tremer') { cena.camera.eventos = cena.camera.eventos || []; const tt = quando(bi, cv, t0);
        cena.camera.eventos.push(tipo === 'punch' ? { tipo: 'punch', t: tt, dur: cv.dur || 0.5, z: cv.z || 0.14 } : { tipo: 'tremer', t: tt, dur: cv.dur || 0.35, amp: cv.amp || 16 }); }
      else if (tipo === 'manual') { cam = { zoom: cv.zoom || cam.zoom, fx: cv.fx ?? cam.fx, fy: cv.fy ?? cam.fy }; cena.camera.chaves.push(Object.assign({ t: kStart.t, corte: !!cv.corte }, cam)); }
      else warns.push(`⚠ bloco ${bi + 1}: câmera "${tipo}" não existe (use push, pull, geral, medio, perto, rosto, punch, tremer)`);
    } else if (!cena.camera.chaves.length) cena.camera.chaves.push(Object.assign({ t: cena.inicio }, cam));
    // Sam
    if (cena.sam) for (const k of [].concat(b.sam || [])) {
      const t = +quando(bi, k, t0 - 0.05).toFixed(3), key = { t };
      for (const f of SAMK) if (k[f] !== undefined) key[f] = k[f]; if (k.expr) key.expressao = k.expr;
      if (key.pose && !POSES[key.pose]) warns.push(`⚠ bloco ${bi + 1}: pose "${key.pose}" não existe`);
      if (key.expressao && !EXPR[key.expressao]) warns.push(`⚠ bloco ${bi + 1}: expressão "${key.expressao}" não existe`);
      if (k.andar_para !== undefined) { cena.sam.acoes.push({ tipo: 'andar', t0: t, t1: t + (k.tempo || 1.1), x0: samAtual.x, x1: k.andar_para }); samAtual.x = k.andar_para; }
      cena.sam.chaves.push(key); for (const f of SAMK) if (key[f] !== undefined) samAtual[f] = key[f];
    }
    for (const a of b.acoes || []) { if (!cena.sam) break; const t = +quando(bi, a, t0).toFixed(3);
      if (a.tipo === 'susto' || a.tipo === 'piscar') cena.sam.acoes.push({ tipo: a.tipo, t, altura: a.altura });
      else if (a.tipo === 'espiar') cena.sam.acoes.push({ tipo: 'espiar', t0: t, t1: t + (a.dur || 2), lado: a.lado || 'direita', ladoV: a.ladoV, y: a.y || 520, expressao: a.expressao || 'sarcastico' });
      else if (a.tipo === 'sair') cena.sam.acoes.push({ tipo: 'sair', t, xFim: a.xFim ?? 2300, xIni: samAtual.x, dur: a.dur || 0.22 });
      else if (a.tipo === 'andar') { cena.sam.acoes.push({ tipo: 'andar', t0: t, t1: t + (a.tempo || 1.1), x0: samAtual.x, x1: a.x }); samAtual.x = a.x; }
      else warns.push(`⚠ bloco ${bi + 1}: ação "${a.tipo}" não existe (use susto, piscar, espiar, sair, andar)`);
      if (auto && a.tipo === 'susto') ep.sfx.push(['boing', t, 0.5]);
    }
    // o que aparece na tela
    for (const e of [].concat(b.tela || [])) {
      if (!EVENT_TYPES.includes(e.tipo)) { warns.push(`⚠ bloco ${bi + 1}: "${e.tipo}" não existe na tela (use ${EVENT_TYPES.join(', ')})`); continue; }
      const ini = +(e.palavra !== undefined ? quando(bi, e, t0) : (e.tipo === 'gancho' && bi === 0 ? 0 : t0)).toFixed(3);
      let fim = e.ate !== undefined ? (acha(bi, e.ate) || { t1: t1 }).t1 + 0.35 : e.dur ? ini + e.dur : e.tipo === 'gancho' ? ini + 2.8 : Math.max(ini + 2.4, t1 + 0.3);
      const ev = Object.assign({}, e); delete ev.palavra; delete ev.ate; delete ev.dur; delete ev.n; ev.t0 = ini; ev.t1 = +fim.toFixed(3);
      if (e.tipo === 'carimbo') { ev.t = ini; if (!e.dur && e.ate === undefined) ev.t1 = +(ini + 1.6).toFixed(3); }
      if (e.tipo === 'lista') ev.itens = (e.itens || []).map(it => { const o = typeof it === 'string' ? { txt: it } : Object.assign({}, it); o.t = +(o.palavra !== undefined ? quando(bi, o, ini) : ini).toFixed(3); delete o.palavra; return o; });
      ep.eventos.push(ev);
      if (auto) { const som = { gancho: 'whoosh', carimbo: 'carimbo', alerta: 'alerta', cuidado: 'ding', fato: 'plim', numero: 'tick', rotulo: 'pop', cartao: 'pop', placa: 'pop', nome: 'whoosh_leve', lista: 'pop' }[e.tipo];
        if (som) ep.sfx.push([som, +Math.max(0, ini - (som.startsWith('whoosh') ? 0.12 : 0)).toFixed(3), som === 'carimbo' ? 0.7 : 0.45]);
        if (e.tipo === 'lista') for (const it of ev.itens) ep.sfx.push(['tick', it.t, 0.4]); }
    }
    for (const f of b.sfx || []) { if (!SFX_NAMES.includes(f.som)) { warns.push(`⚠ bloco ${bi + 1}: som "${f.som}" não existe (use ${SFX_NAMES.join(', ')})`); continue; } ep.sfx.push([f.som, +quando(bi, f, t0).toFixed(3), f.vol ?? 0.6]); }
    if (b.tag !== undefined) { const last = ep.datas.at(-1); if (last && last.t1 > t0) last.t1 = +Math.max(last.t0, t0 - 0.05).toFixed(3); if (b.tag) ep.datas.push({ txt: String(b.tag), t0: +Math.max(0, t0 - 0.05).toFixed(3), t1: dur, pulso: +t0.toFixed(3) }); }
  });
  for (const c of ep.cenas) if (!c.camera.chaves.length) c.camera.chaves.push({ t: c.inicio, zoom: 1.04, fx: 0.5, fy: 0.55 });
  // legenda: frases → blocos de até 6 palavras (cortados na vírgula quando der)
  let frase = [];
  const fecha = () => { if (!frase.length) return; const n = frase.length, partes = Math.ceil(n / 6), alvo = Math.ceil(n / partes); let i = 0;
    while (i < n) { let j = Math.min(n, i + alvo); for (let k = j; k > i + 2 && k > j - 2; k--) if (PHRASE_END.test(frase[k - 1].w)) { j = k; break; }
      const pedaco = frase.slice(i, j); ep.legenda.push({ palavras: pedaco.map(w => [w.w, w.t0]), fim: +pedaco.at(-1).t1.toFixed(3) }); i = j; } frase = []; };
  words.forEach((w, k) => { frase.push(w); if (SENT_END.test(w.w) || (words[k + 1] && words[k + 1].b !== w.b)) fecha(); }); fecha();
  const alvo = rot.duracao_alvo || (ep.formato === '9x16' ? [61, 90] : null);
  if (alvo && dur < alvo[0]) warns.push(`⚠ duração ${dur.toFixed(0)} s: o alvo é ${alvo[0]}–${alvo[1]} s (o TikTok só paga vídeos com 1 minuto ou mais). Acrescente um degrau ou uma piada.`);
  if (alvo && dur > alvo[1] + 2) warns.push(`⚠ duração ${dur.toFixed(0)} s: passou de ${alvo[1]} s. Corte um degrau para segurar a atenção até o fim.`);
  if (rot.aviso_medico !== false) ep.eventos.push({ tipo: 'aviso', t0: ep.formato === '9x16' ? 3.2 : 0.6, t1: ep.formato === '9x16' ? 8.2 : 6.6, txt: rot.aviso_txt || undefined });
  ep.sfx.sort((a, b) => a[1] - b[1]);
  return { ep, warns, palavras: words };
}

/* Legenda: blocos de até 6 palavras, sempre cortados no fim da frase. No 9:16 cada bloco vira pedaços de até
   3 palavras (~18 letras), que cabem grandes na tela do celular. Palavra com hífen nunca é partida. */
function buildSubtitleBlocks(legenda, vert) {
  const bl = legenda.map(b => ({ fim: b.fim, palavras: b.palavras.map(q => [String(q[0]), q[1]]) }));
  const hyph = /^[-\u2013]/, tail = /[-\u2013]$/;
  for (let i = 0; i < bl.length; i++) {
    const ws = bl[i].palavras;
    for (let j = ws.length - 1; j >= 1; j--) if (hyph.test(ws[j][0]) || tail.test(ws[j - 1][0])) { ws[j - 1][0] += ws[j][0]; ws.splice(j, 1); }
    if (i > 0 && ws.length) { const prev = bl[i - 1].palavras;
      if (prev.length && (hyph.test(ws[0][0]) || tail.test(prev[prev.length - 1][0]))) { prev[prev.length - 1][0] += ws[0][0]; ws.shift(); } }
  }
  const out = [];
  for (const b of bl) {
    const words = b.palavras; if (!words.length) continue;
    const t1 = b.fim !== undefined ? b.fim : words[words.length - 1][1] + 0.6;
    if (!vert) { out.push({ t0: words[0][1] - 0.05, t1, palavras: words }); continue; }
    const chunks = []; let cur = [];
    const len = arr => arr.reduce((n, q) => n + q[0].length, 0) + Math.max(0, arr.length - 1);
    for (const w of words) {
      if (cur.length && (cur.length >= 3 || len(cur.concat([w])) > 18 || (cur.length >= 2 && /[,;:]$/.test(cur[cur.length - 1][0])))) { chunks.push(cur); cur = []; }
      cur.push(w);
    }
    if (cur.length) chunks.push(cur);
    const n = chunks.length; // sem palavra sozinha no fim, se couber junto
    if (n >= 2 && chunks[n - 1].length === 1 && chunks[n - 2].length <= 2 && len(chunks[n - 2].concat(chunks[n - 1])) <= 22) { chunks[n - 2] = chunks[n - 2].concat(chunks[n - 1]); chunks.pop(); }
    for (const c of chunks) out.push({ t0: c[0][1] - 0.05, t1, palavras: c });
  }
  out.sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i < out.length - 1; i++) out[i].t1 = Math.min(out[i].t1, out[i + 1].t0);
  return out;
}

/* Validação do catálogo ANTES de renderizar (meta: zero avisos) */
function validate(ep) {
  const w = [];
  for (const [nm, spec] of Object.entries(ep.figurinos || {})) w.push(...validateSpec(nm, spec));
  for (const sc of ep.cenas || []) {
    const s = sc.sam; if (!s) continue;
    const chk = (p, where) => { if (p && !POSES[p]) w.push(`⚠ pose "${p}" não existe (${where})`); };
    const chkE = (e, where) => { if (e && !EXPR[e]) w.push(`⚠ expressão "${e}" não existe (${where})`); };
    chk(s.pose, sc.id); chkE(s.expressao, sc.id);
    const chkP = (p, where) => { if (p && !PROP_NAMES.includes(p)) w.push(`⚠ objeto "${p}" não existe (${where})`); };
    const chkP2 = (p, where) => { if (p && PROPS_DUAS_MAOS.has(p)) w.push(`⚠ prop2 "${p}" é de duas mãos: use em "prop" (${where})`); };
    const chkF = (f, where) => { if (f && !COSTUMES[f]) w.push(`⚠ figurino "${f}" não existe (${where})`); };
    chkP(s.prop, sc.id); chkP(s.prop2, sc.id); chkP2(s.prop2, sc.id); chkF(s.figurino, sc.id);
    for (const k of s.chaves || []) { chk(k.pose, `${sc.id}@${k.t}`); chkE(k.expressao, `${sc.id}@${k.t}`); chkP(k.prop, `${sc.id}@${k.t}`); chkP(k.prop2, `${sc.id}@${k.t}`);
      chkP2(k.prop2, `${sc.id}@${k.t}`); chkF(k.figurino, `${sc.id}@${k.t}`); }
  }
  for (const b of ep.legenda || []) {
    if (b.palavras.length > 6) w.push(`⚠ bloco de legenda com ${b.palavras.length} palavras: "${b.palavras.map(q => q[0]).join(' ')}"`);
    const txt = b.palavras.map(q => q[0]).join(' ');
    const inner = txt.slice(0, -1);
    if (/[.!?](\s|$)/.test(inner) && !/\.\.\.$/.test(txt)) w.push(`⚠ bloco junta duas frases: "${txt}"`);
  }
  for (const e of ep.eventos || []) if (e.tipo && !EVENT_TYPES.includes(e.tipo)) w.push(`⚠ evento "${e.tipo}" não existe`);
  for (const sc of ep.cenas || []) if (sc.cena3d && !CENARIOS_3D.includes(sc.cena3d.cenario)) w.push(`⚠ cenário 3D "${sc.cena3d.cenario}" não existe`);
  w.push(...checkShorts(ep));
  return w;
}

/* Ritmo, datas e gancho — o que mais derruba a retenção, em especial no 9:16 */
function checkShorts(ep) {
  const w = [], vert = ep.formato === '9x16', lim = vert ? 5 : 8, dur = ep.duracao || 0, cenas = (ep.cenas || []).slice().sort((a, b) => a.inicio - b.inicio);
  const tOf = e => (e.t !== undefined ? e.t : e.t0 !== undefined ? e.t0 : null);
  // 1) ritmo: algo novo na tela (corte/zoom, punch, tremida, gag, efeito, ação ou troca de figurino) a cada poucos segundos
  if (dur > 0 && cenas.length) {
    const beats = [0, dur];
    for (const sc of cenas) {
      beats.push(sc.inicio); const cam = sc.camera || {};
      for (const k of cam.chaves || []) beats.push(k.t);
      for (const e of cam.eventos || []) beats.push(tOf(e));
      for (const e of sc.efeitos || []) beats.push(tOf(e));
      const sm = sc.sam || {};
      for (const a of sm.acoes || []) if (a.tipo !== 'piscar') beats.push(tOf(a));
      for (const k of sm.chaves || []) if (k.figurino || k.prop !== undefined) beats.push(k.t);
    }
    for (const e of ep.eventos || []) if (!e.so || e.so === (vert ? '9x16' : '16x9')) { beats.push(tOf(e)); for (const it of e.itens || []) if (it.t !== undefined) beats.push(it.t); }
    const bs = beats.filter(x => x !== null && x >= 0 && x <= dur).sort((a, b) => a - b);
    for (let i = 0; i < bs.length - 1; i++) {
      const gap = bs[i + 1] - bs[i]; if (gap <= lim + 0.05) continue;
      let sc = cenas[0]; for (const c of cenas) if (c.inicio <= bs[i] + 0.01) sc = c;
      if (sc.ritmo === 'livre') continue;
      w.push(`⚠ ritmo: ${gap.toFixed(1)} s sem nada novo na tela (${bs[i].toFixed(1)}–${bs[i + 1].toFixed(1)} s, cena ${sc.id}). No ${vert ? '9:16' : '16:9'}, algo novo a cada ${lim} s: corte ou zoom de câmera, punch, gag, troca de figurino (cena séria: "ritmo": "livre")`);
    }
  }
  // 2) etiqueta de data coerente com a narração
  const datas = ep.datas || [];
  const tagAt = tt => { const d = datas.filter(x => tt >= x.t0 && tt < x.t1).pop(); return d ? String(d.txt) : null; };
  for (const b of ep.legenda || []) for (const [wtxt, wt] of b.palavras) {
    const clean = String(wtxt).replace(/[^\w]/g, '');
    if (/^(1\d{3}|20\d{2})$/.test(clean)) {
      const tag = tagAt(wt + 0.3), ty = tag && /^\d{4}$/.test(tag) ? +tag : null;
      const perto = datas.some(d => String(d.txt).includes(clean) && Math.abs(d.t0 - wt) < 4);
      if (ty !== null && Math.abs(ty - +clean) > 2 && !perto) w.push(`⚠ data: a narração diz ${clean} (${wt.toFixed(1)} s), mas a etiqueta mostra ${tag}`);
    }
    if (/^(today|nowadays)$/i.test(clean)) { const tag = tagAt(wt + 0.3); if (tag && /^\d{3,4}s?$/.test(tag)) w.push(`⚠ data: a narração diz "${clean}" (${wt.toFixed(1)} s), mas a etiqueta ainda mostra ${tag} — use "TODAY"`); }
  }
  // 3) 9:16 abre com o gancho escrito na tela
  if (vert && !(ep.eventos || []).some(e => e.tipo === 'gancho' && (e.t0 || 0) < 1 && (!e.so || e.so === '9x16'))) w.push('⚠ 9:16 sem gancho na tela: adicione {"tipo": "gancho", "t0": 0, "t1": 2.8, "txt": "FRASE CURTA\\nDO GANCHO", "destaque": ["PALAVRA"]}');
  return w;
}

/* desenha um Sam avulso (galeria de figurinos, thumbnails, prévias) */
function drawCharacter(ctx, o) {
  const sam = { x: o.x, chao: o.y, escala: o.s || 1, figurino: o.figurino || 'eua', pose: o.pose || 'idle', expressao: o.expressao || 'deadpan',
    olhar: o.olhar || 0, prop: o.prop || null, prop2: o.prop2 || null, propCores: o.propCores || null, fala: false, seed: o.seed || 0 };
  const st = samState(sam, o.t || 0.5, null); if (o.propMao) st.propMao = o.propMao; drawSam(ctx, st);
}
const PARTS = { tronco: Object.keys(TORSO), frente: Object.keys(FRONT), baixo: Object.keys(LOWER), costas: Object.keys(BACK), chapeu: HAT_NAMES, rosto: Object.keys(FACE).concat(['cabelo']), cabelo: Object.keys(HAIR) };
global.SamEngine = { compilarRoteiro, estimarPalavras, alinharPalavras, bocaDePalavras, envelope, EVENT_TYPES, SFX_NAMES, CENARIOS_3D, create, drawCharacter, makeCostume, validateSpec, POSES, POSE_NAMES, EXPR, EXPR_NAMES, COSTUMES, PROP_NAMES, PRESETS, PARTS, GALLERY_HINT, validate, buildSubtitleBlocks, checkShorts, SAFE_V, version: '7.0' };
})(typeof window !== 'undefined' ? window : globalThis);
