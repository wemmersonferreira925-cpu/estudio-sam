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

/* ---------------- ESTADO DO SAM NO TEMPO t ---------------- */
function samState(sam, t, mouthAt) {
  const st = { x: sam.x, y: sam.chao, s: sam.escala || 1, figurino: sam.figurino || 'eua', visible: sam.visivel !== false,
    lean: 0, sx: 1, sy: 1, jump: 0, shakeX: 0, walk: 0, walkPhase: 0, peek: null, prop: sam.prop || null, propRot: 0,
    fala: sam.fala !== false, speed: 0, flyMap: null };
  let poseName = sam.pose || 'idle', prevPose = poseName, tPose = -1e9;
  let expr = sam.expressao || 'deadpan';
  let look = sam.olhar || 0, prevLook = look, tLook = -1e9, lookY = sam.olharY || 0;
  let propRot = 0, prevPropRot = 0, tPropRot = -1e9;
  const keys = (sam.chaves || []).slice().sort((a, b) => a.t - b.t);
  for (const k of keys) {
    if (k.t > t) break;
    if (k.pose && k.pose !== poseName) { prevPose = poseName; poseName = k.pose; tPose = k.t; }
    if (k.expressao) expr = k.expressao;
    if (k.olhar !== undefined) { prevLook = look; look = k.olhar; tLook = k.t; }
    if (k.olharY !== undefined) lookY = k.olharY;
    if (k.x !== undefined) st.x = k.x;
    if (k.prop !== undefined) st.prop = k.prop;
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
      st.peek = { k: kin * (1 - kout), lado: a.lado || 'direita', y: a.y || 520, expr: a.expressao || 'deadpan' };
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
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = '#fbfbfb'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  ctx.fillStyle = '#dcdcdc'; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.beginPath(); ctx.arc(-0.07 * R, -0.09 * R, R * 0.985, 0, TAU); ctx.fillStyle = '#fbfbfb'; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.lineWidth = RIG.ol; ctx.strokeStyle = INK; ctx.stroke();
  drawFace(ctx, R, st);
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
  // pescoço
  ctx.fillStyle = '#fbfbfb'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  const nTop = HEAD_CY + RIG.headR * 0.7, nBot = RIG.torsoTop + lift + 8;
  ctx.fillRect(-RIG.neckW / 2, nTop, RIG.neckW, nBot - nTop);
  ctx.beginPath(); ctx.moveTo(-RIG.neckW / 2, nTop); ctx.lineTo(-RIG.neckW / 2, nBot); ctx.moveTo(RIG.neckW / 2, nTop); ctx.lineTo(RIG.neckW / 2, nBot); ctx.stroke();
  // tronco (figurino)
  ctx.save(); torsoPath(ctx, lift); ctx.clip(); C.torso(ctx, lift); ctx.restore();
  torsoPath(ctx, lift); ctx.lineWidth = RIG.ol; ctx.strokeStyle = INK; ctx.stroke();
  // braços
  const wave = P.onda ? Math.sin(t * TAU * 3) * 22 : 0;
  const arms = {};
  for (const [key, side] of [['R', 1], ['L', -1]]) {
    const ang = P[key].slice(); if (P.onda === key) ang[1] += wave;
    arms[key] = armPoints(side, ang, lift);
  }
  // mapa (prop) entre as mãos
  if (st.prop === 'mapa') {
    const cx = (arms.R.H[0] + arms.L.H[0]) / 2, cy = (arms.R.H[1] + arms.L.H[1]) / 2 - 8;
    ctx.save(); ctx.translate(cx, cy); drawMapProp(ctx, 150, 100, st.propRot || 0); ctx.restore();
  }
  for (const key of ['R', 'L']) {
    const A = arms[key];
    drawLimb(ctx, [A.S, A.E, A.H], C.armStyle, RIG.limbW);
    if (C.sleeve) { ctx.fillStyle = C.sleeve; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(A.S[0], A.S[1] + 4, 17, 0, TAU); ctx.fill(); ctx.stroke(); }
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
  const p = st.peek, s = st.s * 1.15, k = p.k;
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
function drawMapCard(ctx, L, ev, t) {
  const a = vis(t, ev.t0, ev.t1, 0.3, 0.3); if (a <= 0) return;
  const w = L.v ? 720 : 700, mh = w * (MAP_EXT.lat1 - MAP_EXT.lat0) / (MAP_EXT.lon1 - MAP_EXT.lon0), pad = 18, hh = L.v ? 56 : 44;
  const H = mh + pad * 2 + hh;
  const x = L.v ? (L.W - w - pad * 2) / 2 : 34, y = L.v ? 150 : 34;
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
function drawDateTag(ctx, L, txt, pulse) {
  const fs = L.v ? 46 : 34; ctx.save();
  ctx.font = `bold ${fs}px ${FONT_SUB}`; const w = ctx.measureText(txt).width + fs * 0.9, h = fs * 1.5;
  const x = L.W - w - (L.v ? 46 : 30), y = L.v ? 70 : 28, sc = 1 + 0.2 * pulse;
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(12,12,12,0.92)'; rr(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 2);
  ctx.restore();
}
function drawSubtitles(ctx, L, blocks, t) {
  const b = blocks.find(q => t >= q.t0 && t < q.t1); if (!b) return;
  let fs = L.v ? 62 : 50; const maxW = L.v ? L.W - 120 : L.W - 360;
  ctx.save();
  const words = b.palavras;
  const measure = () => { ctx.font = `bold ${fs}px ${FONT_SUB}`; const sp = ctx.measureText(' ').width; let w = 0; const ws = words.map(q => { const m = ctx.measureText(q[0]).width; w += m; return m; }); w += sp * (words.length - 1); return { w, ws, sp }; };
  let M = measure(); while (M.w > maxW && fs > 26) { fs -= 2; M = measure(); }
  const padX = fs * 0.5, padY = fs * 0.32, h = fs * 1.2 + padY * 2;
  const cy = L.v ? L.H * 0.70 : L.H - 100;
  const pop = 0.94 + 0.06 * Ease.out(inv(b.t0, b.t0 + 0.09, t));
  ctx.translate(L.W / 2, cy); ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(10,10,10,0.74)'; rr(ctx, -M.w / 2 - padX, -h / 2, M.w + padX * 2, h, fs * 0.36); ctx.fill();
  let cur = -1; for (let i = 0; i < words.length; i++) if (t >= words[i][1]) cur = i;
  let x = -M.w / 2; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (let i = 0; i < words.length; i++) {
    ctx.fillStyle = i === cur ? YELLOW : '#ffffff';
    ctx.fillText(words[i][0], x, fs * 0.04); x += M.ws[i] + M.sp;
  }
  ctx.restore();
}
function drawLowerThird(ctx, L, ev, t) {
  const k = Ease.out(inv(ev.t0, ev.t0 + 0.35, t)) * (1 - Ease.in(inv(ev.t1 - 0.3, ev.t1, t))); if (k <= 0) return;
  ctx.save();
  ctx.font = `${L.v ? 50 : 40}px ${FONT_DISPLAY}`; const w1 = ctx.measureText(ev.nome).width;
  ctx.font = `bold ${L.v ? 30 : 25}px ${FONT_SUB}`; const w2 = ctx.measureText(ev.sub || '').width;
  const w = Math.max(w1, w2) + 70, h = L.v ? 140 : 112;
  const x = L.v ? (L.W - w) / 2 : 60, y = L.v ? 230 : L.H - 300;
  ctx.translate(lerp(-w - 80, 0, k), 0); ctx.globalAlpha = clamp(k * 1.5, 0, 1);
  ctx.fillStyle = 'rgba(12,12,12,0.9)'; rr(ctx, x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = YELLOW; ctx.fillRect(x, y, 12, h);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.font = `${L.v ? 50 : 40}px ${FONT_DISPLAY}`; ctx.fillText(ev.nome, x + 36, y + h * 0.5);
  ctx.fillStyle = '#d6d6d6'; ctx.font = `bold ${L.v ? 30 : 25}px ${FONT_SUB}`; ctx.fillText(ev.sub || '', x + 36, y + h * 0.84);
  ctx.restore();
}
function drawPopCard(ctx, L, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const kin = Ease.elastic(inv(ev.t0, ev.t0 + 0.55, t)), kout = 1 - Ease.in(inv(ev.t1 - 0.2, ev.t1, t)), k = kin * kout; if (k <= 0) return;
  const p = L.v && ev.pv ? ev.pv : ev.pos, fs = (ev.tam || 64) * (L.v ? 1.1 : 1);
  ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate((ev.rot || 0) * D2R + Math.sin((t - ev.t0) * 2.2) * 0.02); ctx.scale(k, k);
  ctx.font = `${fs}px ${FONT_DISPLAY}`; const lines = ev.txt.split('\n'); const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + fs * 0.9, h = lines.length * fs * 1.1 + fs * 0.7;
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
function stampCanvas(txt, sub, fs) {
  const key = txt + '|' + sub + '|' + fs; if (stampCache.has(key)) return stampCache.get(key);
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `${fs}px ${FONT_STAMP}`; let w = g.measureText(txt).width + fs * 0.8; const h = fs * 1.25 + (sub ? fs * 0.38 : 0);
  if (sub) { g.font = `bold ${fs * 0.22}px ${FONT_SUB}`; w = Math.max(w, g.measureText(sub).width + fs * 0.6); }
  c.width = Math.ceil(w + 40); c.height = Math.ceil(h + 40); g.translate(20, 20);
  g.strokeStyle = '#c62828'; g.fillStyle = '#c62828'; g.lineWidth = fs * 0.07; rr(g, 0, 0, w, h, fs * 0.12); g.stroke();
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
  const c = stampCanvas(ev.txt, ev.sub || '', ev.tam || 150); const p = L.v && ev.pv ? ev.pv : ev.pos;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(p[0], p[1]); ctx.rotate((ev.rot || -12) * D2R); ctx.scale(sc * (L.v ? 0.9 : 1), sc * (L.v ? 0.9 : 1));
  ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore();
}
function drawCalendar(ctx, L, ev, t) {
  const a = vis(t, ev.t0, ev.t1, 0.25, 0.25); if (a <= 0) return;
  const pop = Ease.back(inv(ev.t0, ev.t0 + 0.35, t)); const p = L.v && ev.pv ? ev.pv : ev.pos;
  const w = 330, h = 360;
  const n = Math.round(lerp(ev.de, ev.ate, clamp((t - ev.tA) / (ev.tB - ev.tA), 0, 1)));
  const frac = ((t - ev.tA) / (ev.tB - ev.tA)) * (ev.ate - ev.de); const flip = t > ev.tA && t < ev.tB ? 1 - (frac % 1) : 0;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(p[0], p[1]); ctx.scale(pop * (L.v ? 1.25 : 1), pop * (L.v ? 1.25 : 1)); ctx.rotate(3 * D2R);
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
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p[0], p[1] + (L.v ? 290 : 235)); ctx.scale(k, k); ctx.rotate(-4 * D2R);
    ctx.font = `64px ${FONT_DISPLAY}`; const w2 = ctx.measureText(ev.rodape).width + 50;
    ctx.fillStyle = YELLOW; rr(ctx, -w2 / 2, -48, w2, 96, 14); ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ev.rodape, 0, 4); ctx.restore();
  }
}
function drawReview(ctx, L, ev, t) {
  if (t < ev.t0 || t > ev.t1) return;
  const kin = Ease.back(inv(ev.t0, ev.t0 + 0.4, t)), kout = Ease.in(inv(ev.t1 - 0.3, ev.t1, t));
  const p = L.v && ev.pv ? ev.pv : ev.pos, w = 680, h = 380;
  ctx.save(); ctx.translate(p[0] + kout * (L.v ? 0 : 1200), p[1] + (1 - kin) * 700 + (L.v ? kout * 1400 : 0)); ctx.rotate(-2 * D2R); if (L.v) ctx.scale(1.2, 1.2);
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
  const d = t - ev.t0, p = L.v && ev.pv ? ev.pv : ev.pos;
  const drop = Ease.back(clamp(d / 0.38, 0, 1));
  const y = lerp(-420, p[1], drop), ang = d > 0.3 ? 20 * Math.exp(-2.3 * (d - 0.3)) * Math.cos(8 * (d - 0.3)) : -8;
  const out = Ease.in(inv(ev.t1 - 0.25, ev.t1, t));
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(p[0], -40); ctx.rotate(ang * D2R); if (L.v) ctx.scale(1.2, 1.2);
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
  return { z, fx, fy, rot, shx, shy };
}

/* ---------------- MOTOR ---------------- */
function create(canvas, episode, assets) {
  const fmt = episode.formato || '16x9';
  const L = fmt === '9x16' ? { W: 1080, H: 1920, v: true } : { W: 1920, H: 1080, v: false };
  canvas.width = L.W; canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const world = document.createElement('canvas'); world.width = L.W; world.height = L.H; const wctx = world.getContext('2d');
  const world2 = document.createElement('canvas'); world2.width = L.W; world2.height = L.H; const wctx2 = world2.getContext('2d');
  const fps = episode.fps || 30;
  const boca = assets.boca || null;
  const mouthAt = t => { if (!boca) return 0; const i = Math.floor(t * fps); return boca[clamp(i, 0, boca.length - 1)] || 0; };
  const scenes = episode.cenas.slice().sort((a, b) => a.inicio - b.inicio);
  const subs = buildSubtitleBlocks(episode.legenda || []);
  const warnings = validate(episode);

  function renderWorld(g, scene, t) {
    const cam = camAt(scene, t, L.v);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, L.W, L.H);
    let base = L.v ? (L.H / 1080) : (L.W / 1920);
    const extra = cam.rot ? 1.035 : 1;
    const z = base * cam.z * extra;
    const F = [cam.fx * 1920, cam.fy * 1080];
    let cx = L.W / 2, cy = L.H / 2;
    if (!L.v) { cx = F[0] * L.W / 1920; cy = F[1] * L.H / 1080; }
    g.translate(cx + cam.shx, cy + cam.shy); g.rotate(cam.rot * D2R); g.scale(z, z);
    let Fx = F[0], Fy = F[1];
    if (L.v) { const half = (L.W / 2) / z; Fx = clamp(Fx, half, 1920 - half); const halfH = (L.H / 2) / z; Fy = clamp(Fy, halfH, 1080 - halfH); }
    g.translate(-Fx, -Fy);
    VIEW.x0 = Fx - (L.v ? L.W / 2 : cx) / z; VIEW.x1 = Fx + (L.v ? L.W / 2 : (L.W - cx)) / z;
    const img = assets.images[scene.fundo];
    if (img) g.drawImage(img, 0, 0, 1920, 1080); else { g.fillStyle = '#7aa'; g.fillRect(0, 0, 1920, 1080); }
    // efeitos de mundo atrás do Sam
    for (const ev of (scene.efeitos || [])) {
      if (ev.tipo === 'poeira') drawDust(g, ev, t);
      if (ev.tipo === 'brilho') drawSparkle(g, ev, t);
    }
    if (scene.sam) {
      const st = samState(scene.sam, t, mouthAt);
      if (st.speed > 0) drawSpeedLines(g, st.speedX0 !== undefined ? st.speedX0 : scene.sam.x, Math.min(st.x, 1920 + 300), st.y, t, st.speed);
      drawSam(g, st);
      if (st.flyMap !== null) drawFlyingMap(g, st, st.flyMap);
      for (const ev of (scene.efeitos || [])) if (ev.tipo === 'simbolo') drawSymbolAt(g, st.x + (ev.dx || 70) * st.s, st.y - (ev.dy || 540) * st.s - st.jump, ev, t);
    }
    g.restore();
  }

  function renderAt(t) {
    // cena atual + transição
    let i = 0; for (let k = 0; k < scenes.length; k++) if (scenes[k].inicio <= t) i = k;
    const sc = scenes[i], tr = sc.entrada || { tipo: 'corte', dur: 0 };
    renderWorld(wctx, sc, t);
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
    for (const ev of (episode.eventos || [])) {
      switch (ev.tipo) {
        case 'raios': drawGodRays(ctx, L, ev, t); break;
        case 'mapa': drawMapCard(ctx, L, ev, t); break;
        case 'nome': drawLowerThird(ctx, L, ev, t); break;
        case 'cartao': drawPopCard(ctx, L, ev, t); break;
        case 'carimbo': drawStamp(ctx, L, ev, t); break;
        case 'calendario': drawCalendar(ctx, L, ev, t); break;
        case 'review': drawReview(ctx, L, ev, t); break;
        case 'placa': drawSign(ctx, L, ev, t); break;
      }
    }
    // etiqueta de data
    const dt = (episode.datas || []).filter(d => t >= d.t0 && t < d.t1).pop();
    if (dt) { const pulse = dt.pulso ? Math.sin(Math.PI * clamp((t - dt.pulso) / 0.35, 0, 1)) : 0; drawDateTag(ctx, L, dt.txt, pulse); }
    drawSubtitles(ctx, L, subs, t);
    if (episode.fade_final) { const a = inv(episode.duracao - episode.fade_final, episode.duracao, t); if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, L.W, L.H); } }
  }
  return { renderAt, duration: episode.duracao, fps, L, warnings, subs };
}

/* Legenda: blocos de até 6 palavras, sempre cortados no fim da frase */
function buildSubtitleBlocks(legenda) {
  const out = [];
  for (const b of legenda) {
    const words = b.palavras; // [[texto, inicio], ...]
    const t1 = b.fim !== undefined ? b.fim : words[words.length - 1][1] + 0.6;
    out.push({ t0: words[0][1] - 0.05, t1, palavras: words });
  }
  out.sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i < out.length - 1; i++) out[i].t1 = Math.min(out[i].t1, out[i + 1].t0);
  return out;
}

/* Validação do catálogo ANTES de renderizar (meta: zero avisos) */
function validate(ep) {
  const w = [];
  for (const sc of ep.cenas || []) {
    const s = sc.sam; if (!s) continue;
    const chk = (p, where) => { if (p && !POSES[p]) w.push(`⚠ pose "${p}" não existe (${where})`); };
    const chkE = (e, where) => { if (e && !EXPR[e]) w.push(`⚠ expressão "${e}" não existe (${where})`); };
    chk(s.pose, sc.id); chkE(s.expressao, sc.id);
    if (s.figurino && !COSTUMES[s.figurino]) w.push(`⚠ figurino "${s.figurino}" não existe (${sc.id})`);
    for (const k of s.chaves || []) { chk(k.pose, `${sc.id}@${k.t}`); chkE(k.expressao, `${sc.id}@${k.t}`); }
  }
  for (const b of ep.legenda || []) {
    if (b.palavras.length > 6) w.push(`⚠ bloco de legenda com ${b.palavras.length} palavras: "${b.palavras.map(q => q[0]).join(' ')}"`);
    const txt = b.palavras.map(q => q[0]).join(' ');
    const inner = txt.slice(0, -1);
    if (/[.!?](\s|$)/.test(inner) && !/\.\.\.$/.test(txt)) w.push(`⚠ bloco junta duas frases: "${txt}"`);
  }
  return w;
}

global.SamEngine = { create, POSES, POSE_NAMES, EXPR, EXPR_NAMES, COSTUMES, validate, version: '6.0' };
})(typeof window !== 'undefined' ? window : globalThis);
