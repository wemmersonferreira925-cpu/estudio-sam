# Gera o motor v7 a partir de uma cópia do v6.3 (o arquivo do v6 nunca é tocado).
import re, sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new, count=1):
    global s
    if old not in s: raise SystemExit('NÃO ACHEI: ' + old[:80])
    s = s.replace(old, new, count)

# 1) expressões e poses novas (valem no 2D e no 3D)
rep("  irritado:       { brows: 'angry', eyes: 'lid', mouth: 'line' },\n",
    "  irritado:       { brows: 'angry', eyes: 'lid', mouth: 'line' },\n"
    "  sarcastico:     { brows: 'one_up', eyes: 'lid', mouth: 'smirk' },\n"
    "  revirando:      { brows: 'flat', eyes: 'lid', mouth: 'line' },\n"
    "  julgando:       { brows: 'angry', eyes: 'lid', mouth: 'smirk' },\n"
    "  preocupado:     { brows: 'worried', eyes: 'lid', mouth: 'line' },\n")
rep("  assinar:         { R: [18, -100], L: [10, 6], cab: 4 },\n",
    "  assinar:         { R: [18, -100], L: [10, 6], cab: 4 },\n"
    "  sarcasmo:        { R: [100, -8],  L: [35, -66], cab: 4, dedo: 'R' },\n"
    "  sarcasmo_esq:    { R: [35, -66],  L: [100, -8], cab: -4, dedo: 'L' },\n"
    "  bracos_cruzados: { R: [22, -112], L: [18, -104], cab: 2 },\n"
    "  explicar:        { R: [45, 30],   L: [8, 6] },\n"
    "  explicar_esq:    { R: [8, 6],     L: [45, 30] },\n")
# no 2D a expressão "revirando" olha para cima
rep("  let look = sam.olhar || 0, prevLook = look, tLook = -1e9, lookY = sam.olharY || 0;",
    "  let look = sam.olhar || 0, prevLook = look, tLook = -1e9, lookY = sam.olharY || 0;\n  st.prancha = sam.prancha || null;")
rep("    if (k.olharY !== undefined) lookY = k.olharY;",
    "    if (k.olharY !== undefined) lookY = k.olharY;\n    if (k.prancha !== undefined) st.prancha = k.prancha;")

# 2) carimbo com cor (MYTH vermelho, TRUE verde…)
rep("function stampCanvas(txt, sub, fs) {\n  const key = txt + '|' + sub + '|' + fs;",
    "const STAMP_COR = { vermelho: '#c62828', verde: '#1f9d55', azul: '#1e6fd9', laranja: '#e8710a', roxo: '#7b3fe4' };\nfunction stampCanvas(txt, sub, fs, cor) {\n  cor = STAMP_COR[cor] || cor || '#c62828';\n  const key = txt + '|' + sub + '|' + fs + '|' + cor;")
rep("  g.strokeStyle = '#c62828'; g.fillStyle = '#c62828'; g.lineWidth = fs * 0.07;", "  g.strokeStyle = cor; g.fillStyle = cor; g.lineWidth = fs * 0.07;")
rep("const c = stampCanvas(ev.txt, ev.sub || '', ev.tam || 150),", "const c = stampCanvas(ev.txt, ev.sub || '', ev.tam || 150, ev.cor),")

# 3) cartões de saúde, contador, checklist, rótulo com seta e aviso médico
NEW_OVERLAYS = r'''
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
  const fs = (ev.tam || 170) * (L.v ? 0.82 : 1);
  ctx.save(); ctx.font = `${fs}px ${FONT_STAMP}`; let bw = ctx.measureText(big).width; let sc = 1;
  const lim = L.v ? (SAFE_V.x1 - SAFE_V.x0 - 40) : 1500; if (bw > lim) sc = lim / bw;
  ctx.font = `${fs * 0.3}px ${FONT_DISPLAY}`; const lines = ev.txt ? wrapLines(ctx, ev.txt, L.v ? 760 : 1100) : [];
  const h = fs * sc * 1.05 + lines.length * fs * 0.36;
  const p = placeV(L, posV(L, ev, [1180, 360]), Math.min(bw * sc, lim) / 2 + 20, h / 2 + 20);
  ctx.translate(p[0], p[1]); ctx.scale(k, k); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${fs * sc}px ${FONT_STAMP}`; ctx.lineJoin = 'round'; ctx.lineWidth = fs * sc * 0.11; ctx.strokeStyle = INK;
  const y0 = -h / 2 + fs * sc * 0.5; ctx.strokeText(big, 0, y0); ctx.fillStyle = ev.cor || YELLOW; ctx.fillText(big, 0, y0);
  ctx.font = `${fs * 0.3}px ${FONT_DISPLAY}`; ctx.lineWidth = fs * 0.05; ctx.fillStyle = '#ffffff';
  lines.forEach((q, i) => { const yy = y0 + fs * sc * 0.62 + (i + 0.5) * fs * 0.36; ctx.strokeText(q, 0, yy); ctx.fillText(q, 0, yy); });
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
  const x = L.v ? (L.W - w) / 2 : 40, y = L.v ? 1150 - h : 40;
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

'''
rep("function camAt(scene, t, vert) {", NEW_OVERLAYS + "function camAt(scene, t, vert) {")

# 4) motor: Sam 3D, cenário 3D e vídeo de fundo
rep("  const warnings = validate(episode);\n",
    "  const warnings = validate(episode);\n"
    "  const S3 = (episode.sam3d === false || !global.Sam3D) ? null : global.Sam3D.create({ estilo: episode.estilo3d || assets.estilo3d || 'A', qualidade: assets.qualidade });\n"
    "  const videos = assets.videos || {};\n")
rep("""    const img = assets.images[scene.fundo];
    if (img) g.drawImage(img, 0, 0, 1920, 1080); else { g.fillStyle = '#7aa'; g.fillRect(0, 0, 1920, 1080); }""",
"""    VIEW.m = g.getTransform();
    if (st && st.visible && !st.peek) { VIEW.samHead = [st.x, st.y - st.jump + HEAD_CY * st.s]; const P = st.pose;
      VIEW.samHand = { R: [st.x + (RIG.shoulderX + Math.sin(P.R[0] * D2R) * RIG.upper + Math.sin((P.R[0] + P.R[1]) * D2R) * (RIG.fore + 22)) * st.s, st.y - st.jump + (RIG.shoulderY + Math.cos(P.R[0] * D2R) * RIG.upper + Math.cos((P.R[0] + P.R[1]) * D2R) * (RIG.fore + 22)) * st.s],
        L: [st.x - (RIG.shoulderX + Math.sin(P.L[0] * D2R) * RIG.upper + Math.sin((P.L[0] + P.L[1]) * D2R) * (RIG.fore + 22)) * st.s, st.y - st.jump + (RIG.shoulderY + Math.cos(P.L[0] * D2R) * RIG.upper + Math.cos((P.L[0] + P.L[1]) * D2R) * (RIG.fore + 22)) * st.s] }; }
    else { VIEW.samHead = null; VIEW.samHand = null; }
    const img = assets.images[scene.fundo], vid = scene.video && videos[scene.video];
    if (scene.cena3d && S3) {
      const m = g.getTransform(), iv = m.inverse(), zz = Math.hypot(m.a, m.b) || 1;
      const pts = [[0, 0], [L.W, 0], [0, L.H], [L.W, L.H]].map(([x, y]) => iv.transformPoint(new DOMPoint(x, y)));
      const x0 = Math.min(...pts.map(q => q.x)), x1 = Math.max(...pts.map(q => q.x)), y0 = Math.min(...pts.map(q => q.y)), y1 = Math.max(...pts.map(q => q.y));
      S3.drawSet(g, scene.cena3d, t, { x0, y0, x1, y1, pw: (x1 - x0) * zz, ph: (y1 - y0) * zz }, assets);
    } else if (vid) { g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080); drawCover(g, vid, 0, 0, 1920, 1080); }
    else if (img) g.drawImage(img, 0, 0, 1920, 1080); else { const gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#1d5f77'); gr.addColorStop(1, '#0a1e2a'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080); }""")
rep("      drawSam(g, st);\n",
    "      if (S3) S3.drawSam(g, st, { luz: scene.luz || (scene.cena3d && S3.setLight(scene.cena3d)) || 'neutro', prancha: st.prancha, sombra: scene.sombra, vertical: L.v, v0: VIEW.x0, v1: VIEW.x1 });\n"
    "      else drawSam(g, st);\n")
rep("    renderWorld(wctx, sc, t); const headBox = VIEW.head;",
    "    renderWorld(wctx, sc, t); const headBox = VIEW.head, worldM = VIEW.m, samHead = VIEW.samHead, samHand = VIEW.samHand;\n"
    "    const toScreen = pt => { if (!pt) return null; const q = worldM.transformPoint(new DOMPoint(pt[0], pt[1])); return [q.x, q.y]; };\n"
    "    const alvoDe = ev => { const a = ev.alvo; if (Array.isArray(a)) return toScreen(a); if (a === 'sam' || a === 'cabeca') return toScreen(samHead && [samHead[0], samHead[1] - 40]);\n"
    "      if (a === 'mao' || a === 'mao_R' || a === 'mao_L') return toScreen(samHand && samHand[a === 'mao_L' ? 'L' : 'R']);\n"
    "      if (typeof a === 'string' && S3 && sc.cena3d) return toScreen(S3.anchor(sc.cena3d, a, t, assets)); return null; };")
rep("        case 'gancho': drawHook(ctx, L, ev, t); break;\n",
    "        case 'gancho': drawHook(ctx, L, ev, t); break;\n"
    "        case 'alerta': drawHealthCard(ctx, L, ev, t, 'alerta'); break;\n"
    "        case 'cuidado': drawHealthCard(ctx, L, ev, t, 'cuidado'); break;\n"
    "        case 'fato': drawHealthCard(ctx, L, ev, t, 'fato'); break;\n"
    "        case 'numero': drawCounter(ctx, L, ev, t); break;\n"
    "        case 'lista': drawChecklist(ctx, L, ev, t); break;\n"
    "        case 'rotulo': if (t >= ev.t0 && t <= ev.t1) drawLabel(ctx, L, ev, t, alvoDe(ev)); break;\n"
    "        case 'aviso': drawDisclaimer(ctx, L, ev, t); break;\n")
rep("  return { renderAt, duration: episode.duracao, fps, L, warnings, subs };",
    "  return { renderAt, duration: episode.duracao, fps, L, warnings, subs, sam3d: !!S3 };")

# 5) roteiro (o Grok escreve isto) → episódio com tempos
COMPILER = r'''
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
// alinha as palavras estimadas ao áudio real: tempo de fala (sem pausas) proporcional às sílabas + início de frase colado na volta da voz
function alinharPalavras(words, env, hz) {
  const n = env.length; if (!n || !words.length) return words;
  const srt = Array.from(env).sort((a, b) => a - b), noise = srt[Math.floor(n * 0.08)] || 0, peak = srt[Math.floor(n * 0.98)] || 1e-3;
  const thr = noise + (peak - noise) * 0.1, sp = new Uint8Array(n);
  for (let i = 0; i < n; i++) sp[i] = env[i] > thr ? 1 : 0;
  const run = (val, maxLen) => { let i = 0; while (i < n) { if (sp[i] === val) { let j = i; while (j < n && sp[j] === val) j++; if (j - i <= maxLen && i > 0 && j < n) for (let k = i; k < j; k++) sp[k] = 1 - val; i = j; } else i++; } };
  run(0, Math.round(0.07 * hz)); run(1, Math.round(0.03 * hz));
  const cum = new Float32Array(n + 1); for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + sp[i];
  const speech = cum[n]; if (speech < 5) return words;
  const wts = words.map(w => 0.11 + 0.17 * syllables(w.w)), tot = wts.reduce((a, b) => a + b, 0);
  const frameAt = target => { let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; } return lo; };
  const onsets = []; for (let i = 1; i < n; i++) if (sp[i] && !sp[i - 1]) onsets.push(i / hz);
  let acc = 0; const out = words.map((w, k) => { const s0 = acc / tot * speech; acc += wts[k]; const s1 = acc / tot * speech;
    let f0 = frameAt(s0 + 0.5); while (f0 < n && !sp[f0]) f0++; return Object.assign({}, w, { t0: f0 / hz, t1: frameAt(s1) / hz }); });
  for (let k = 0; k < out.length; k++) {   // início de frase cola na volta da voz depois de uma pausa
    const prev = words[k - 1]; if (k > 0 && !(SENT_END.test(prev.w) || PHRASE_END.test(prev.w) || prev.b !== words[k].b)) continue;
    let best = null; for (const o of onsets) if (Math.abs(o - out[k].t0) < 0.5 && (best === null || Math.abs(o - out[k].t0) < Math.abs(best - out[k].t0))) best = o;
    if (best !== null) out[k].t0 = best;
  }
  for (let k = 1; k < out.length; k++) { if (out[k].t0 < out[k - 1].t0 + 0.06) out[k].t0 = out[k - 1].t0 + 0.06; out[k - 1].t1 = Math.min(out[k - 1].t1, out[k].t0); }
  return out.map(w => Object.assign(w, { t0: +w.t0.toFixed(3), t1: +Math.max(w.t1, w.t0 + 0.08).toFixed(3) }));
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
      cena.sam = c.sam === false ? null : Object.assign({}, samAtual, c.sam || {}, { chaves: [], acoes: [] });
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
      else if (CAM_ZOOM[tipo]) { const kk = { geral: 0, medio: 0.4, perto: 0.75, rosto: 1 }[tipo]; cam = { zoom: CAM_ZOOM[tipo], fx: +lerp(0.5, sx, kk).toFixed(3), fy: +lerp(0.55, headY, kk).toFixed(3) }; cena.camera.chaves.push(Object.assign({ t: kStart.t, corte: true }, cam)); }
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
  if (rot.aviso_medico !== false) ep.eventos.push({ tipo: 'aviso', t0: ep.formato === '9x16' ? 3.2 : 0.6, t1: ep.formato === '9x16' ? 8.2 : 6.6, txt: rot.aviso_txt || undefined });
  ep.sfx.sort((a, b) => a[1] - b[1]);
  return { ep, warns, palavras: words };
}
'''
rep("/* Legenda: blocos de até 6 palavras,", COMPILER + "\n/* Legenda: blocos de até 6 palavras,")

# 6) validação: aceitar os tipos novos
rep("  w.push(...checkShorts(ep));\n  return w;\n}",
    "  for (const e of ep.eventos || []) if (e.tipo && !EVENT_TYPES.includes(e.tipo)) w.push(`⚠ evento \"${e.tipo}\" não existe`);\n"
    "  for (const sc of ep.cenas || []) if (sc.cena3d && !CENARIOS_3D.includes(sc.cena3d.cenario)) w.push(`⚠ cenário 3D \"${sc.cena3d.cenario}\" não existe`);\n"
    "  w.push(...checkShorts(ep));\n  return w;\n}")

# 7) exportações
rep("SamEngine = { create, drawCharacter,", "SamEngine = { compilarRoteiro, estimarPalavras, alinharPalavras, bocaDePalavras, envelope, EVENT_TYPES, SFX_NAMES, CENARIOS_3D, create, drawCharacter,")
rep("version: '6.3' };", "version: '7.0' };")
open(p, 'w').write(s)
print('motor v7 ok', len(s))
