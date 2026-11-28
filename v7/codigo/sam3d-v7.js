// Sam Studio v7 — Sam 3D + cenários 3D (Three.js). O motor 2D continua mandando em tudo (tempo, câmera, legendas,
// cartões); este módulo só desenha o Sam e o fundo 3D dentro do quadro que o motor pede.
// Unidade 3D = 1 raio de cabeça = 80 px do rig 2D. Pés do Sam em y = 0, ele olha para +z (para a câmera).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const VERSION = '7.0';
const D2R = Math.PI / 180, TAU = Math.PI * 2, PX = 80, H_CY = 4.735, FACE_SIZE = 1.7, INK = 0x151515;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k * k * (3 - 2 * k);
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ================= ROSTO (mesmas medidas do drawFace 2D + expressões sarcásticas) ================= */
export const EXPR = {
  deadpan: { brows: 'flat', eyes: 'lid', mouth: 'line' }, serio: { brows: 'flat', eyes: 'lid', mouth: 'line' },
  neutro: { brows: 'flat', eyes: 'lid', mouth: 'line' }, falando: { brows: 'flat', eyes: 'lid', mouth: 'line' },
  cetico: { brows: 'one_up', eyes: 'lid', mouth: 'line' }, sorriso: { brows: 'flat', eyes: 'lid', mouth: 'smirk' },
  orgulhoso: { brows: 'up_small', eyes: 'lid', mouth: 'smirk' }, surpreso: { brows: 'up', eyes: 'wide', mouth: 'o' },
  assustado: { brows: 'worried', eyes: 'wide', mouth: 'o', sweat: true }, feliz: { brows: 'up_small', eyes: 'happy', mouth: 'smile' },
  olhos_fechados: { brows: 'flat', eyes: 'closed', mouth: 'line' }, irritado: { brows: 'angry', eyes: 'lid', mouth: 'line' },
  sarcastico: { brows: 'one_up', eyes: 'lid', mouth: 'smirk' },
  revirando: { brows: 'flat', eyes: 'lid', mouth: 'line', lookY: -1.6 },
  julgando: { brows: 'angry_small', eyes: 'lid', mouth: 'smirk', look: 0.6 },
  preocupado: { brows: 'worried', eyes: 'lid', mouth: 'line' },
};
export function paintFace(g, st = {}) {
  const E = EXPR[st.expr] || EXPR.deadpan, look = st.look ?? E.look ?? 0, lookY = st.lookY ?? E.lookY ?? 0, blink = st.blink || 0, m = clamp(st.m || 0, 0, 1);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#151515'; g.fillStyle = '#151515';
  const eyeX = 0.37, eyeY = -0.03, lx = clamp(look, -1, 1) * 0.075, ly = lookY * 0.05, by = -0.36, bw = 0.23;
  g.lineWidth = 0.075;
  for (const s of [-1, 1]) {
    let yi = by, yo = by;
    if (E.brows === 'up') yi = yo = by - 0.13; else if (E.brows === 'up_small') yi = yo = by - 0.06;
    else if (E.brows === 'worried') { yi = by - 0.15; yo = by - 0.02; } else if (E.brows === 'angry') { yi = by + 0.07; yo = by - 0.05; }
    else if (E.brows === 'angry_small') { yi = by + 0.04; yo = by - 0.02; }
    else if (E.brows === 'one_up' && s > 0) { yi = by - 0.17; yo = by - 0.12; }
    g.beginPath(); g.moveTo(s * (eyeX - bw), yi); g.lineTo(s * (eyeX + bw * 1.05), yo); g.stroke();
  }
  const bl = (E.eyes === 'lid' || E.eyes === 'wide') ? blink : 0;
  for (const s of [-1, 1]) {
    const ex = s * eyeX;
    if (E.eyes === 'lid') {
      const ly0 = eyeY - 0.03, pr = 0.105, open = 1 - bl;
      if (lookY < -0.5) { g.beginPath(); g.ellipse(ex + lx, ly0 + 0.02, pr, pr * 0.45, 0, Math.PI, 0); g.closePath(); g.fill(); }
      else { g.beginPath(); g.ellipse(ex + lx, ly0 + ly * 0.3, pr, pr * Math.max(open, 0.02), 0, 0, Math.PI); g.closePath(); g.fill(); }
      g.lineWidth = 0.06; g.beginPath(); g.moveTo(ex - 0.17, ly0); g.lineTo(ex + 0.17, ly0); g.stroke();
    } else if (E.eyes === 'wide') {
      const open = 1 - bl; g.beginPath(); g.ellipse(ex + lx, eyeY + ly, 0.125, 0.135 * Math.max(open, 0.04), 0, 0, TAU); g.fill();
      if (open > 0.5) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx - 0.04, eyeY + ly - 0.045, 0.035, 0, TAU); g.fill(); g.fillStyle = '#151515'; }
    } else if (E.eyes === 'closed') { g.lineWidth = 0.06; g.beginPath(); g.arc(ex, eyeY - 0.06, 0.13, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    else if (E.eyes === 'happy') { g.lineWidth = 0.065; g.beginPath(); g.arc(ex, eyeY + 0.03, 0.12, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
  }
  const my = 0.40; g.lineWidth = 0.065;
  if (E.mouth === 'o') { g.fillStyle = '#2a0c0c'; g.beginPath(); g.ellipse(0, my, 0.1, 0.13 + 0.05 * m, 0, 0, TAU); g.fill(); g.lineWidth = 0.05; g.stroke(); g.fillStyle = '#151515'; }
  else if (m > 0.05 && (E.mouth === 'line' || E.mouth === 'smirk')) {
    const w = 0.34, h = 0.045 + 0.24 * m, x = -w / 2, y = my - h * 0.3, r = Math.min(h / 2, 0.08);
    g.fillStyle = '#2a0c0c'; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); g.lineWidth = 0.05; g.stroke();
    if (h > 0.14) { g.fillStyle = '#c9504f'; g.beginPath(); g.ellipse(0, y + h * 0.78, w * 0.26, h * 0.16, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#151515';
  } else if (E.mouth === 'smirk') { g.beginPath(); g.moveTo(-0.19, my + 0.01); g.quadraticCurveTo(0.06, my + 0.08, 0.21, my - 0.07); g.stroke(); }
  else if (E.mouth === 'smile') { g.beginPath(); g.arc(0, my - 0.12, 0.22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
  else { g.beginPath(); g.moveTo(-0.19, my); g.lineTo(0.19, my); g.stroke(); }
  if (E.sweat) { g.fillStyle = '#7cc7ff'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(0.7, -0.6); g.quadraticCurveTo(0.84, -0.34, 0.7, -0.28); g.quadraticCurveTo(0.56, -0.34, 0.7, -0.6); g.fill(); g.stroke(); }
}

/* ================= TEXTURAS ================= */
function coatTexture(y0, y1) {
  const W = 2048, H = 1024, c = cv(W, H), g = c.getContext('2d'), r = rng(11);
  const Y = y => (1 - (y - y0) / (y1 - y0)) * H, U = du => W / 2 + du * W;
  g.fillStyle = '#f6f8fa'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '190,200,210'},${0.05 + r() * 0.06})`; g.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3); }
  g.fillStyle = '#7fd6b3'; g.beginPath(); g.moveTo(U(-0.075), Y(y1)); g.lineTo(U(0.075), Y(y1)); g.lineTo(U(0), Y(3.02)); g.closePath(); g.fill();
  g.strokeStyle = '#5fb894'; g.lineWidth = 7; g.beginPath(); g.moveTo(U(-0.05), Y(y1)); g.lineTo(U(0), Y(3.2)); g.lineTo(U(0.05), Y(y1)); g.stroke();
  g.strokeStyle = '#c3ccd6'; g.lineWidth = 9; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(U(-0.078), Y(y1)); g.lineTo(U(-0.012), Y(2.95)); g.lineTo(U(-0.012), Y(y0)); g.stroke();
  g.beginPath(); g.moveTo(U(0.078), Y(y1)); g.lineTo(U(0.012), Y(2.95)); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(U(-0.07), Y(3.55)); g.lineTo(U(-0.105), Y(3.3)); g.lineTo(U(-0.05), Y(3.2)); g.stroke();
  g.beginPath(); g.moveTo(U(0.07), Y(3.55)); g.lineTo(U(0.105), Y(3.3)); g.lineTo(U(0.05), Y(3.2)); g.stroke();
  g.fillStyle = '#aeb8c4'; for (const y of [2.75, 2.35, 1.95]) { g.beginPath(); g.arc(U(0.03), Y(y), 12, 0, TAU); g.fill(); }
  g.strokeStyle = '#c3ccd6'; g.lineWidth = 7; g.strokeRect(U(0.06), Y(3.08), 0.05 * W, Y(2.78) - Y(3.08));
  g.fillStyle = '#2f6fd6'; g.fillRect(U(0.07), Y(3.2), 14, Y(3.05) - Y(3.2)); g.fillStyle = '#e74c3c'; g.fillRect(U(0.083), Y(3.17), 14, Y(3.05) - Y(3.17));
  for (const s of [-1, 1]) g.strokeRect(U(s > 0 ? 0.05 : -0.115), Y(2.2), 0.065 * W, Y(1.8) - Y(2.2));
  g.fillStyle = '#3d7bd9'; g.fillRect(U(-0.105), Y(3.08), 0.04 * W, Y(2.86) - Y(3.08)); g.fillStyle = '#ffffff'; g.fillRect(U(-0.098), Y(3.04), 0.026 * W, Y(2.98) - Y(3.04));
  g.strokeStyle = '#d3dae2'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, Y(y0 + 0.06)); g.lineTo(W, Y(y0 + 0.06)); g.stroke();
  return tex(c);
}

/* contorno de desenho animado: casco invertido em normais suavizadas (funciona com InstancedMesh) */
const outlineMat = (w) => new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { w: { value: w } },
  vertexShader: 'uniform float w; void main(){ vec4 p = vec4(position + normal * w, 1.0);\n#ifdef USE_INSTANCING\n p = instanceMatrix * p;\n#endif\n gl_Position = projectionMatrix * modelViewMatrix * p; }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.055,0.055,0.06,1.0); }' });
function outlineGeo(geo) { let g = geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g = mergeVertices(g, 1e-4); g.computeVertexNormals(); return g; }
function addOutline(mesh, w) { const o = new THREE.Mesh(outlineGeo(mesh.geometry), outlineMat(w)); o.userData.outline = true; mesh.add(o); return o; }
function toonGradient() { const t = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; }
const GRAD = { t: null }; const grad = () => GRAD.t || (GRAD.t = toonGradient());

// brilho de borda (rim) do estilo A: uma faixa de luz dura na borda, do lado da luz de recorte
export const RIM = { color: { value: new THREE.Color(0xffffff) }, strength: { value: 0.55 }, dir: { value: new THREE.Vector2(-0.75, 0.55) } };
function rimToon(m) {
  m.onBeforeCompile = (sh) => { sh.uniforms.uRimColor = RIM.color; sh.uniforms.uRimStrength = RIM.strength; sh.uniforms.uRimDir = RIM.dir;
    sh.fragmentShader = 'uniform vec3 uRimColor; uniform float uRimStrength; uniform vec2 uRimDir;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      'float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\nfloat rimM = smoothstep(-0.1, 0.45, dot(normalize(normal.xy + 1e-4), normalize(uRimDir)));\noutgoingLight += uRimColor * uRimStrength * smoothstep(0.58, 0.66, rimF) * rimM;\n#include <opaque_fragment>'); };
  m.customProgramCacheKey = () => 'rimtoon'; return m;
}
function materials(style) {
  const A = style === 'A';
  const toon = (color, o = {}) => rimToon(new THREE.MeshToonMaterial({ color, gradientMap: grad(), ...o }));
  const soft = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, ...o });
  const fabric = { roughness: 0.78, sheen: 0.7, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) };
  return {
    A,
    head: A ? toon(0xffffff) : soft(0xffffff, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: new THREE.Color(0xdde8ff) }),
    face: (map) => A ? new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
      : new THREE.MeshPhysicalMaterial({ map, transparent: true, depthWrite: false, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    coat: (map) => A ? toon(0xffffff, { map }) : soft(0xffffff, { map, ...fabric }),
    sleeve: A ? toon(0xf6f8fa) : soft(0xf6f8fa, fabric),
    scrubs: A ? toon(0x7fd6b3) : soft(0x7fd6b3, { roughness: 0.8, sheen: 0.5, sheenColor: new THREE.Color(0xc9ffe9) }),
    ink: A ? toon(INK) : soft(0x1a1a1c, { roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    tube: A ? toon(0x2f3640) : soft(0x2f3640, { roughness: 0.35, clearcoat: 0.5 }),
    metal: A ? toon(0xc9ced6) : soft(0xd5dbe3, { roughness: 0.18, metalness: 1.0 }),
    rbc: A ? toon(0xd9333e) : soft(0xc81f2c, { roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.22, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xff6f70), emissive: 0x2a0004 }),
  };
}

/* hemácia: disco bicôncavo (perfil de Evans & Fung, um pouco mais gordinho para ler bem no desenho) */
export function rbcGeometry(radius = 1, chunk = 1.15) {
  const pts = [], n = 40, h = r => Math.sqrt(Math.max(0, 1 - r * r)) * (0.1036 + 1.0013 * r * r - 0.5614 * r ** 4) * chunk;
  for (let i = 0; i <= n; i++) { const r = Math.sin(i / n * Math.PI / 2); pts.push(new THREE.Vector2(Math.max(r, 1e-3) * radius, -h(r) * radius)); }
  for (let i = n - 1; i >= 0; i--) { const r = Math.sin(i / n * Math.PI / 2); pts.push(new THREE.Vector2(Math.max(r, 1e-3) * radius, h(r) * radius)); }
  const g = new THREE.LatheGeometry(pts, 96); g.computeVertexNormals(); g.userData.top = h(0) * radius; return g;
}

/* ================= O BONECO ================= */
function buildSam(style) {
  const M = materials(style), root = new THREE.Group(), body = new THREE.Group(), meshes = [];
  root.add(body);
  const put = (parent, geo, mat, pos, ow, tag) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos); m.castShadow = m.receiveShadow = true; parent.add(m); meshes.push([m, ow]); if (tag) m.userData.tag = tag; return m; };
  // cabeça + rosto (decalque projetado de frente — de frente fica idêntico ao 2D)
  const headG = new THREE.Group(); headG.position.set(0, H_CY, 0); body.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), M.head); head.castShadow = head.receiveShadow = true; head.updateMatrixWorld(true);
  const faceC = cv(1024, 1024), faceG = faceC.getContext('2d'), faceTex = tex(faceC);
  const face = new THREE.Mesh(new DecalGeometry(head, V(0, 0, 0.75), new THREE.Euler(), V(FACE_SIZE, FACE_SIZE, 1.0)), M.face(faceTex));
  face.renderOrder = 2; head.add(face); headG.add(head); meshes.push([head, 0.034]);
  const peekNeck = put(headG, new THREE.CylinderGeometry(0.19, 0.19, 1.9, 32), M.head, V(0, -1.75, 0), 0.02, 'peek'); peekNeck.visible = false;
  // corpo (tudo que some quando ele "espia" da borda)
  const torso = new THREE.Group(); body.add(torso);
  put(torso, new THREE.CylinderGeometry(0.2, 0.22, 0.34, 32), M.head, V(0, 3.8, 0), 0.02);
  put(torso, new THREE.TorusGeometry(0.235, 0.05, 16, 48), M.scrubs, V(0, 3.69, 0), 0.012).rotation.x = Math.PI / 2;
  const prof = [[0.02, 1.62], [0.8, 1.44], [0.86, 1.46], [0.84, 1.8], [0.78, 2.3], [0.74, 2.85], [0.73, 3.25], [0.71, 3.47], [0.64, 3.63], [0.46, 3.74], [0.24, 3.78], [0.02, 3.79]];
  const coatGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 160, Math.PI, Math.PI * 2);
  { const p = coatGeo.attributes.position, uv = coatGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setY(i, (p.getY(i) - 1.44) / (3.79 - 1.44)); uv.needsUpdate = true; }
  put(torso, coatGeo, M.coat(coatTexture(1.44, 3.79)), null, 0.03).scale.set(1, 1, 0.7);
  const zf = (x) => 0.7 * Math.sqrt(Math.max(0, 0.735 * 0.735 - x * x)) + 0.035;
  const tube = (pts, r = 0.045) => put(torso, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 12), M.tube, null, 0.012);
  tube([V(-0.3, 3.62, 0.3), V(-0.36, 3.3, zf(-0.36)), V(-0.3, 2.95, zf(-0.3)), V(-0.1, 2.72, zf(-0.1)), V(0.02, 2.68, zf(0.02))]);
  tube([V(0.3, 3.62, 0.3), V(0.37, 3.3, zf(0.37)), V(0.32, 3.0, zf(0.32)), V(0.24, 2.86, zf(0.24))]);
  tube([V(-0.3, 3.62, 0.3), V(-0.25, 3.78, -0.05), V(0, 3.8, -0.27), V(0.25, 3.78, -0.05), V(0.3, 3.62, 0.3)]);
  put(torso, new THREE.CylinderGeometry(0.15, 0.15, 0.07, 40), M.metal, V(0.03, 2.62, zf(0.03) + 0.03), 0.012).rotation.x = Math.PI / 2;
  put(torso, new THREE.SphereGeometry(0.06, 20, 16), M.metal, V(0.24, 2.84, zf(0.24) + 0.02), 0.01);
  // braços: "R" = lado direito da tela (+x), "L" = lado esquerdo (−x), igual ao catálogo de poses 2D
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.6, 3.43, 0); torso.add(sh);
    put(sh, new THREE.SphereGeometry(0.17, 32, 24), M.sleeve, V(0, 0, 0), 0.022);
    put(sh, new THREE.CapsuleGeometry(0.145, 0.72, 10, 28), M.sleeve, V(0, -0.38, 0), 0.022);
    const el = new THREE.Group(); el.position.set(0, -0.8, 0); sh.add(el);
    put(el, new THREE.CapsuleGeometry(0.135, 0.6, 10, 28), M.sleeve, V(0, -0.34, 0), 0.022);
    put(el, new THREE.CylinderGeometry(0.15, 0.15, 0.09, 28), M.sleeve, V(0, -0.68, 0), 0.015);
    const hand = put(el, new THREE.SphereGeometry(0.19, 32, 24), M.ink, V(0, -0.86, 0), 0.02);
    const finger = put(el, new THREE.CapsuleGeometry(0.055, 0.22, 6, 12), M.ink, V(0, -1.1, 0.02), 0.012); finger.visible = false;
    return { sh, el, hand, finger };
  };
  const arms = { R: arm(1), L: arm(-1) };
  const legs = {};
  for (const [key, s] of [['R', 1], ['L', -1]]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.3, 1.75, 0); torso.add(hip);
    put(hip, new THREE.CapsuleGeometry(0.095, 1.45, 8, 20), M.ink, V(0, -0.73, 0), 0.02);
    put(hip, new THREE.SphereGeometry(1, 40, 28), M.ink, V(s * 0.03, -1.62, 0.1), 0.02).scale.set(0.19, 0.14, 0.33);
    legs[key] = hip;
  }
  // prancha: hemácia gigante (para "surfar" na corrente sanguínea)
  const board = new THREE.Mesh(rbcGeometry(1), M.rbc); board.scale.setScalar(1.9); board.position.y = -board.geometry.userData.top * 1.9 + 0.02;
  board.castShadow = board.receiveShadow = true; board.visible = false; root.add(board); meshes.push([board, 0.016]);
  if (M.A) for (const [m, w] of meshes) if (w) addOutline(m, w / (m.scale.x || 1));
  return { root, body, torso, headG, head, face, peekNeck, faceC, faceG, faceTex, arms, legs, board, lastFace: '' };
}

/* estado do motor 2D (samState) → pose 3D */
function applyState(R, st, peek) {
  const P = st.pose || { R: [8, 6], L: [8, 6] }, t = st.t || 0;
  const breath = Math.sin(t * TAU / 3.1), liftPx = (P.ombros || 0) + breath * 1.2, lift = liftPx / PX;
  const walk = !!st.walk, swing = walk ? Math.sin(st.walkPhase || 0) : 0;
  for (const [key, side] of [['R', 1], ['L', -1]]) {
    const a = R.arms[key], ang = (P[key] || [8, 6]).slice(); if (P.onda === key) ang[1] += Math.sin(t * TAU * 3) * 22;
    const a1 = ang[0] * D2R, a2 = ang[1] * D2R;
    const hx = side * (0.6 + Math.sin(a1) * 0.8 + Math.sin(a1 + a2) * 0.86), hy = 3.43 - Math.cos(a1) * 0.8 - Math.cos(a1 + a2) * 0.86;
    const inside = (Math.abs(hx) < 0.95 && hy > 1.5 && hy < 3.95) ? clamp((0.95 - Math.abs(hx)) / 0.45, 0, 1) : 0;
    a.sh.position.y = 3.43 - lift;
    a.sh.rotation.set(-0.08 - 0.55 * inside - (walk ? side * swing * 0.35 : 0), 0, side * a1);
    a.el.rotation.set(-0.12 - 0.8 * inside, 0, side * a2);
    a.finger.visible = P.dedo === key && !peek;
  }
  R.legs.R.rotation.x = walk ? swing * 0.5 : 0; R.legs.L.rotation.x = walk ? -swing * 0.5 : 0;
  const talkTilt = (st.mouth || 0) * 2.2 * Math.sin(t * 5.3);
  R.headG.position.y = H_CY - (liftPx * 0.6 + breath * 1.5) / PX;
  R.headG.rotation.set(clamp(st.lookY || 0, -1.5, 1.5) * 0.1, clamp(st.look || 0, -1, 1) * 0.38, -((P.cab || 0) + talkTilt + (st.headTilt || 0)) * D2R);
  const dir = walk ? Math.sign(st.lean || 0) : 0;
  R.body.rotation.set(0, dir ? dir * 0.85 : clamp(st.look || 0, -1, 1) * 0.12 + (st.yaw || 0), -(st.lean || 0) * D2R);
  R.body.position.y = walk ? Math.abs(swing) * 0.09 : 0;
  R.root.scale.set(st.sx || 1, st.sy || 1, st.sx || 1);
  R.torso.visible = !peek; R.peekNeck.visible = !!peek;
  // rosto: só repinta quando muda
  const fk = [st.expr, (+(st.look || 0)).toFixed(2), (+(st.lookY || 0)).toFixed(2), (+(st.blink || 0)).toFixed(2), (+(st.mouth || 0)).toFixed(2)].join('|');
  if (fk !== R.lastFace) {
    const g = R.faceG; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1024, 1024); g.translate(512, 512); g.scale(1024 / FACE_SIZE, 1024 / FACE_SIZE);
    paintFace(g, { expr: st.expr, look: st.look, lookY: st.lookY, blink: st.blink, m: st.mouth });
    R.faceTex.needsUpdate = true; R.lastFace = fk;
  }
}

/* luzes por clima de cena */
const LIGHTS = {
  neutro: { hemi: [0xeaf2ff, 0x4a4038, 1.5, 0.6], key: [0xfff1e4, 2.4, 2.6], rim: [0x9fd8ff, 1.4, 2.2], fill: [0xffffff, 0.5, 0.8] },
  arteria: { hemi: [0xffe6e6, 0x5a1018, 1.6, 0.55], key: [0xfff1e8, 2.4, 2.7], rim: [0xff8f9c, 1.6, 2.8], fill: [0xffd8d8, 0.5, 0.9] },
  noite: { hemi: [0xbfd4ff, 0x1a2030, 1.2, 0.45], key: [0xdfe9ff, 2.0, 2.2], rim: [0x7fb2ff, 1.6, 2.6], fill: [0x9fb4ff, 0.4, 0.6] },
  quente: { hemi: [0xfff0d8, 0x5a4020, 1.6, 0.6], key: [0xffe2b8, 2.5, 2.8], rim: [0xffb36b, 1.5, 2.4], fill: [0xffe8d0, 0.5, 0.8] },
};
function makeLights(scene, style) {
  const A = style === 'A', i = A ? 2 : 3;
  const hemi = new THREE.HemisphereLight(); const key = new THREE.DirectionalLight(); const rim = new THREE.DirectionalLight(); const fill = new THREE.DirectionalLight();
  key.position.set(6, 11, 9); key.target.position.set(0, 2.5, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -3, near: 1, far: 40 }); key.shadow.radius = A ? 2 : 6; key.shadow.blurSamples = 16; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  rim.position.set(-6, 6, -8); fill.position.set(-8, 3, 7);
  scene.add(hemi, key, key.target, rim, fill);
  return (name) => { const L = LIGHTS[name] || LIGHTS.neutro; RIM.color.value.setHex(L.rim[0]); RIM.strength.value = A ? 0.6 : 0;
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = A ? L.hemi[2] : L.hemi[3];
    key.color.setHex(L.key[0]); key.intensity = A ? L.key[1] : L.key[2]; rim.color.setHex(L.rim[0]); rim.intensity = A ? L.rim[1] : L.rim[2];
    fill.color.setHex(L.fill[0]); fill.intensity = A ? L.fill[1] : L.fill[2]; };
}

/* ================= RENDER DO SAM (camada transparente, colada no quadro 2D) ================= */
class SamLayer {
  constructor(style) {
    this.style = style; this.canvas = cv(4, 4);
    const r = this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setClearColor(0x000000, 0); r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true; r.shadowMap.type = style === 'A' ? THREE.PCFShadowMap : THREE.VSMShadowMap;
    this.scene = new THREE.Scene();
    if (style === 'B') { const pm = new THREE.PMREMGenerator(r); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.35; }
    this.rig = buildSam(style); this.scene.add(this.rig.root);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: style === 'A' ? 0.3 : 0.34 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.setLights = makeLights(this.scene, style); this.light = ''; this.cam = new THREE.PerspectiveCamera(20, 1, 0.5, 200); this.size = [0, 0];
  }
  // st = samState do motor; o = { luz, prancha, sombra, max }
  draw(ctx, st, o = {}) {
    const peek = st.peek, R = this.rig;
    if ((o.luz || 'neutro') !== this.light) { this.setLights(o.luz || 'neutro'); this.light = o.luz || 'neutro'; }
    const prancha = !peek && (o.prancha === 'hemacia');
    R.board.visible = prancha; this.floor.visible = !prancha && !peek && o.sombra !== false;
    let s, cx, cy, top, bot, halfW, rot = 0;
    if (peek) {
      const p = Object.assign({}, peek); if (o.vertical) p.lado = p.ladoV || 'esquerda';
      s = st.s * 1.15; const k = p.k; cx = p.lado === 'esquerda' ? lerp(o.v0 - 120, o.v0 + 150, k) : lerp(o.v1 + 120, o.v1 - 150, k); cy = p.y;
      rot = (p.lado === 'esquerda' ? 18 : -18); top = 1.6; bot = 3.4; halfW = 2.6;
      st = Object.assign({}, st, { expr: p.expr || 'deadpan', look: p.lado === 'esquerda' ? 0.6 : -0.6, walk: 0, lean: 0, sx: 1, sy: 1 });
    } else { s = st.s; cx = st.x + (st.shakeX || 0); cy = st.y - (st.jump || 0); top = 6.75; bot = prancha ? 1.6 : 0.9; halfW = 4.3; }
    applyState(R, st, peek);
    if (peek) { R.root.position.set(0, -H_CY, 0); R.headG.rotation.z = -rot * D2R; R.body.rotation.set(0, 0, 0); }
    else {
      R.root.position.set(0, 0, 0); R.root.rotation.set(0, 0, 0);
      if (prancha) { const t = st.t || 0; R.root.rotation.set(0.05 * Math.sin(t * 0.9), 0.25 + 0.06 * Math.sin(t * 0.5), 0.04 * Math.sin(t * 1.3)); R.root.position.y = 0.06 * Math.sin(t * 1.7); }
    }
    // retângulo do mundo (px) que esta camada cobre
    const ww = 2 * halfW * PX * s, wh = (top + bot) * PX * s, wx0 = cx - ww / 2, wy0 = cy - top * PX * s;
    const m = ctx.getTransform(), zoom = Math.hypot(m.a, m.b) || 1;
    let pw = Math.max(16, Math.round(ww * zoom)), ph = Math.max(16, Math.round(wh * zoom)); const cap = o.max || 1500;
    if (ph > cap) { pw = Math.round(pw * cap / ph); ph = cap; }
    if (pw !== this.size[0] || ph !== this.size[1]) { this.r.setSize(pw, ph, false); this.size = [pw, ph]; }
    const yc = (top - bot) / 2, d = ((top + bot) / 2) / Math.tan(10 * D2R);
    this.cam.aspect = pw / ph; this.cam.position.set(0, yc, d); this.cam.lookAt(0, yc, 0); this.cam.updateProjectionMatrix();
    this.r.render(this.scene, this.cam);
    ctx.drawImage(this.canvas, wx0, wy0, ww, wh);
  }
}

/* ================= CENÁRIOS 3D (fundo do quadro, com câmera própria) ================= */
function wallTextures(seed) {
  const r = rng(seed), W = 1024, H = 1024, c = cv(W, H), g = c.getContext('2d'), b = cv(W, H), gb = b.getContext('2d');
  g.fillStyle = '#9a1f2c'; g.fillRect(0, 0, W, H); gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, w = 10 + r() * 40, a = 0.08 + r() * 0.12;
    for (const [ctx, col] of [[g, `rgba(255,120,130,${a})`], [gb, `rgba(255,255,255,${a * 2})`]]) {
      const gr = ctx.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; for (const dx of [0, -W, W]) ctx.fillRect(x - w + dx, 0, 2 * w, H);
    }
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H, rad = 6 + r() * 22, d = r() < 0.5;
    g.fillStyle = d ? `rgba(70,0,10,${0.05 + r() * 0.08})` : `rgba(255,150,150,${0.04 + r() * 0.07})`; g.beginPath(); g.ellipse(x, y, rad * 0.6, rad * 1.4, 0, 0, TAU); g.fill();
    gb.fillStyle = d ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'; gb.beginPath(); gb.ellipse(x, y, rad * 0.6, rad * 1.4, 0, 0, TAU); gb.fill();
  }
  g.strokeStyle = 'rgba(90,10,40,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 18; i++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 14; k++) { x += (r() - 0.5) * 60; y += 20 + r() * 50; g.lineTo(x, y); } g.stroke(); }
  const t1 = tex(c), t2 = tex(b, false); for (const t of [t1, t2]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 5); }
  return [t1, t2];
}
function radialBg(inner, mid, outer, cx = 0.54, cy = 0.39, rad = 0.52) {
  const c = cv(512, 288), g = c.getContext('2d'), gr = g.createRadialGradient(512 * cx, 288 * cy, 0, 512 * cx, 288 * cy, 512 * rad);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 512, 288); return tex(c);
}

// ARTÉRIA: túnel vermelho, hemácias correndo, um glóbulo branco ao fundo. Âncoras para rótulos: celula1..3, globulo_branco
function setArteria(style) {
  const A = style === 'A', M = materials(style), scene = new THREE.Scene(), r = rng(7);
  const FOG = A ? 0x7a1820 : 0x5c1018;
  scene.fog = A ? new THREE.Fog(FOG, 22, 85) : new THREE.FogExp2(FOG, 0.021);
  scene.background = radialBg(A ? '#ffb39a' : '#ff9a84', A ? '#d84a52' : '#b8323c', '#' + FOG.toString(16).padStart(6, '0'));
  const [wm, wb] = wallTextures(3);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 160, 128, 60, true),
    A ? rimToon(new THREE.MeshToonMaterial({ color: 0xff9ea4, map: wm, gradientMap: grad(), side: THREE.BackSide }))
      : new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: wm, bumpMap: wb, bumpScale: 2.5, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.28, sheen: 0.6, sheenColor: new THREE.Color(0xff8a90), side: THREE.BackSide }));
  wall.rotation.x = Math.PI / 2; wall.position.set(0, 3.2, -55); wall.receiveShadow = true; scene.add(wall);
  const geo = rbcGeometry(1), heroes = {}, flow = [];
  const hero = (name, x, y, z, s, rx, ry, rz) => { const m = new THREE.Mesh(geo, M.rbc); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(rx, ry, rz);
    m.castShadow = m.receiveShadow = true; if (A) addOutline(m, 0.03); scene.add(m); m.userData.base = { x, y, z, rx, ry, rz }; if (name) heroes[name] = m; return m; };
  hero('celula1', 3.6, 3.9, 0.5, 1.25, 1.05, 0.2, 0.5).userData.baseV = { x: 1.9, y: 5.4, z: 1.0, rx: 1.05, ry: 0.2, rz: 0.5 };
  hero('celula2', 6.6, 1.3, -1.8, 1.35, 0.55, 0, -0.4).userData.baseV = { x: 2.6, y: 1.6, z: -2.6, rx: 0.55, ry: 0, rz: -0.4 };
  hero('celula3', 5.4, 6.2, -5, 1.2, 1.35, 0.3, 0.2).userData.baseV = { x: -2.2, y: 7.4, z: -4, rx: 1.35, ry: 0.3, rz: 0.2 };
  hero(null, 1.4, 0.4, -3.5, 1.1, 0.25, 0, 0.9); hero(null, 8.4, 5.2, 2.2, 1.0, 1.5, 0.6, 0.1); hero(null, -7.2, 6.5, -2, 1.15, 0.8, 0.1, -0.6); hero(null, -6.0, 0.2, 3.2, 0.9, 1.2, 0.4, 0.3);
  const N = 70, inst = new THREE.InstancedMesh(geo, M.rbc, N); inst.castShadow = inst.receiveShadow = true; scene.add(inst);
  let instO = null; if (A) { instO = new THREE.InstancedMesh(outlineGeo(geo), outlineMat(0.03), N); scene.add(instO); }
  for (let i = 0; i < N; i++) { const a = r() * TAU, rad = Math.sqrt(r()) * 6.6; flow.push({ x: Math.cos(a) * rad, y: 3.2 + Math.sin(a) * rad, z: -8 - r() * 88, s: 0.95 + r() * 0.5, rx: r() * 3, ry: r() * 3, rz: r() * 3, w: 0.2 + r() * 0.6, v: 0.85 + r() * 0.3 }); }
  let wg = new THREE.IcosahedronGeometry(2.1, 7); wg.deleteAttribute('normal'); wg.deleteAttribute('uv'); wg = mergeVertices(wg);
  { const p = wg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize();
      const d = 1 + 0.07 * Math.sin(v.x * 9 + v.y * 4) * Math.sin(v.y * 8 - v.z * 5) + 0.05 * Math.sin(v.z * 13 + v.x * 6); p.setXYZ(i, v.x * 2.1 * d, v.y * 2.1 * d, v.z * 2.1 * d); } }
  wg.computeVertexNormals();
  const wbc = new THREE.Mesh(wg, A ? rimToon(new THREE.MeshToonMaterial({ color: 0xf3e9f7, gradientMap: grad() })) : new THREE.MeshPhysicalMaterial({ color: 0xf2e8f5, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xd6c2ff), emissive: 0x140818 }));
  wbc.position.set(6.8, -1.4, -15); wbc.scale.setScalar(0.85); wbc.castShadow = true; scene.add(wbc); if (A) addOutline(wbc, 0.05); heroes.globulo_branco = wbc;
  const key = new THREE.DirectionalLight(0xfff1e8, A ? 2.4 : 2.7); key.position.set(3, 13, 12); key.target.position.set(0, 2.6, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -8, near: 1, far: 60 }); key.shadow.radius = A ? 2 : 7; key.shadow.blurSamples = 16; key.shadow.bias = -0.0005;
  scene.add(new THREE.HemisphereLight(0xffe6e6, 0x5a1018, A ? 1.6 : 0.55), key, key.target);
  const rim = new THREE.DirectionalLight(0xff9aa6, A ? 1.6 : 2.6); rim.position.set(-6, 5, -9); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xbfe3ff, A ? 0.6 : 1.4); rim2.position.set(9, 3, -6); scene.add(rim2);
  const cam = new THREE.PerspectiveCamera(31, 1920 / 1080, 0.1, 400), dummy = new THREE.Object3D();
  return {
    scene, cam, heroes, focus: 18.2, luz: 'arteria',
    update(t, def, assets, vert, cx3 = 0) {
      const vel = def.fluxo ?? 1, dz = (def.voo || 0) * t;   // fluxo: velocidade das hemácias; voo: câmera avançando pelo vaso (unid/s)
      cam.position.set(0.8 + 0.35 * Math.sin(t * 0.21), 4.1 + 0.2 * Math.sin(t * 0.16), 19.5 - dz); cam.lookAt(0.2 + 0.2 * Math.sin(t * 0.13), 2.7, -dz);
      for (const [n, m] of Object.entries(heroes)) { if (n === 'globulo_branco') { m.rotation.y = t * 0.15; if (vert) m.position.set(cx3 + 2.4, 8.6, -12); else m.position.set(6.8, -1.4, -15); continue; }
        const b = (vert && m.userData.baseV) || m.userData.base, ox = vert ? cx3 : 0; m.position.set(ox + b.x + 0.25 * Math.sin(t * 0.5 + b.x), b.y + 0.3 * Math.sin(t * 0.7 + b.z), b.z - dz); m.rotation.set(b.rx + t * 0.12, b.ry + t * 0.08, b.rz); }
      for (let i = 0; i < N; i++) { const f = flow[i]; let z = f.z - t * 6 * vel * f.v; z = cam.position.z - 30 - (((cam.position.z - 30 - z) % 96) + 96) % 96;
        dummy.position.set(f.x, f.y, z); dummy.rotation.set(f.rx + t * f.w, f.ry + t * f.w * 0.7, f.rz); dummy.scale.setScalar(f.s); dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix); if (instO) instO.setMatrixAt(i, dummy.matrix); }
      inst.instanceMatrix.needsUpdate = true; if (instO) instO.instanceMatrix.needsUpdate = true;
      wall.position.z = cam.position.z - 75;
    },
  };
}

// ESTÚDIO: ciclorama azul-petróleo com telão (mostra imagem/vídeo do Grok Imagine ou do Flow; sem mídia, mostra um monitor cardíaco)
function setEstudio(style) {
  const A = style === 'A', scene = new THREE.Scene();
  const bg = cv(1024, 512), g = bg.getContext('2d'); const gr = g.createRadialGradient(330, 200, 20, 400, 260, 700);
  gr.addColorStop(0, '#2c6f86'); gr.addColorStop(0.55, '#123a4d'); gr.addColorStop(1, '#071722'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  g.globalAlpha = 0.07; g.strokeStyle = '#bfefff'; g.lineWidth = 2;
  for (let y = 0; y < 512; y += 26) for (let x = (y / 26) % 2 ? 0 : 15; x < 1024; x += 30) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); } g.closePath(); g.stroke(); }
  const backT = tex(bg);
  const backMat = A ? new THREE.MeshToonMaterial({ map: backT, gradientMap: grad() }) : new THREE.MeshPhysicalMaterial({ map: backT, roughness: 0.9 });
  const cyc = new THREE.Mesh(new THREE.PlaneGeometry(80, 40, 1, 1), backMat); cyc.position.set(0, 18, -14); scene.add(cyc);
  const floorMat = A ? new THREE.MeshToonMaterial({ color: 0x0e3445, gradientMap: grad() }) : new THREE.MeshPhysicalMaterial({ color: 0x0f3343, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 4); floor.receiveShadow = true; scene.add(floor);
  scene.fog = new THREE.Fog(0x071722, 26, 60);
  // telão
  const screenC = cv(1280, 720), sg = screenC.getContext('2d'), screenT = tex(screenC);
  const scr = new THREE.Group(); scr.position.set(5.3, 4.5, -6.2); scr.rotation.y = -0.3; scene.add(scr);
  const bez = new THREE.Mesh(new THREE.BoxGeometry(9.4, 5.5, 0.35), A ? new THREE.MeshToonMaterial({ color: 0x1b1f26, gradientMap: grad() }) : new THREE.MeshPhysicalMaterial({ color: 0x15181d, roughness: 0.35, metalness: 0.4, clearcoat: 0.6 }));
  scr.add(bez); if (A) addOutline(bez, 0.04);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 5.06), new THREE.MeshBasicMaterial({ map: screenT, toneMapped: false })); panel.position.z = 0.18; scr.add(panel);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 16), bez.material); leg.position.set(5.3, 0.9, -6.3); scene.add(leg);
  // hélice de DNA (gira devagar) e faixas de luz na parede
  const dna = new THREE.Group(); dna.position.set(-7.6, 0, -8.5); scene.add(dna);
  const mA = A ? rimToon(new THREE.MeshToonMaterial({ color: 0x46d1ff, gradientMap: grad() })) : new THREE.MeshPhysicalMaterial({ color: 0x46d1ff, roughness: 0.3, clearcoat: 0.6 });
  const mB = A ? rimToon(new THREE.MeshToonMaterial({ color: 0xff6fa8, gradientMap: grad() })) : new THREE.MeshPhysicalMaterial({ color: 0xff6fa8, roughness: 0.3, clearcoat: 0.6 });
  const mR = A ? rimToon(new THREE.MeshToonMaterial({ color: 0xe9f6ff, gradientMap: grad() })) : new THREE.MeshPhysicalMaterial({ color: 0xe9f6ff, roughness: 0.4 });
  const ball = new THREE.SphereGeometry(0.26, 24, 16), rung = new THREE.CylinderGeometry(0.07, 0.07, 1, 12);
  for (let i = 0; i < 26; i++) { const y = 0.5 + i * 0.36, a = i * 0.5, p1 = V(Math.cos(a) * 1.1, y, Math.sin(a) * 1.1), p2 = V(-Math.cos(a) * 1.1, y, -Math.sin(a) * 1.1);
    const b1 = new THREE.Mesh(ball, mA), b2 = new THREE.Mesh(ball, mB); b1.position.copy(p1); b2.position.copy(p2); b1.castShadow = b2.castShadow = true; dna.add(b1, b2); if (A) { addOutline(b1, 0.03); addOutline(b2, 0.03); }
    const r = new THREE.Mesh(rung, mR); r.position.copy(p1.clone().add(p2).multiplyScalar(0.5)); r.scale.y = 2.0; r.quaternion.setFromUnitVectors(V(0, 1, 0), p2.clone().sub(p1).normalize()); dna.add(r); }
  const stripM = new THREE.MeshBasicMaterial({ color: 0x5fe0ff, toneMapped: false });
  for (const [x, w] of [[-12, 0.12], [-2.2, 0.08], [11.5, 0.12]]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(w, 30), stripM); st.position.set(x, 15, -13.9); scene.add(st); }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.08, toneMapped: false, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-3.6, 0.01, 2.5); scene.add(pool);
  scene.add(new THREE.HemisphereLight(0xdff4ff, 0x0a1a22, A ? 1.5 : 0.6));
  const key = new THREE.DirectionalLight(0xfff3e6, A ? 2.2 : 2.6); key.position.set(4, 12, 10); key.target.position.set(0, 2, -2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 12, bottom: -6, near: 1, far: 50 }); key.shadow.radius = A ? 2 : 8; key.shadow.blurSamples = 16; key.shadow.bias = -0.0005;
  scene.add(key, key.target); const rim = new THREE.DirectionalLight(0x7fe0ff, A ? 1.2 : 2.0); rim.position.set(-8, 6, -6); scene.add(rim);
  const pl = new THREE.PointLight(0x6fd8ff, A ? 8 : 14, 14, 2); pl.position.set(5.3, 4.5, -4.3); scene.add(pl);
  const cam = new THREE.PerspectiveCamera(30, 1920 / 1080, 0.1, 400);
  let lastSrc = null;
  function ecg(t) {   // monitor cardíaco padrão do telão
    sg.fillStyle = '#04141c'; sg.fillRect(0, 0, 1280, 720); sg.strokeStyle = 'rgba(80,220,255,0.12)'; sg.lineWidth = 1;
    for (let x = 0; x < 1280; x += 40) { sg.beginPath(); sg.moveTo(x, 0); sg.lineTo(x, 720); sg.stroke(); } for (let y = 0; y < 720; y += 40) { sg.beginPath(); sg.moveTo(0, y); sg.lineTo(1280, y); sg.stroke(); }
    sg.strokeStyle = 'rgba(93,255,176,0.8)'; sg.lineWidth = 6; sg.shadowColor = '#5dffb0'; sg.shadowBlur = 14; sg.beginPath();
    const beat = 1.0, head = (t % 4) / 4 * 1280;
    for (let x = 0; x <= 1280; x += 4) { const tt = (x / 1280) * 4 + Math.floor(t / 4) * 4 - (x > head ? 4 : 0), ph = (tt % beat) / beat;
      let y = 0; if (ph > 0.10 && ph < 0.14) y = -40 * Math.sin((ph - 0.10) / 0.04 * Math.PI); else if (ph > 0.18 && ph < 0.2) y = 30 * (ph - 0.18) / 0.02; else if (ph > 0.2 && ph < 0.235) y = 30 - 290 * (ph - 0.2) / 0.035; else if (ph > 0.235 && ph < 0.27) y = -260 + 300 * (ph - 0.235) / 0.035; else if (ph > 0.35 && ph < 0.45) y = -50 * Math.sin((ph - 0.35) / 0.1 * Math.PI);
      const yy = 380 + y; if (Math.abs(x - head) < 6) { sg.stroke(); sg.beginPath(); sg.moveTo(x + 40, 380); x += 40; continue; } x === 0 ? sg.moveTo(x, yy) : sg.lineTo(x, yy); }
    sg.stroke(); sg.shadowBlur = 0; sg.fillStyle = 'rgba(93,255,176,0.55)'; sg.font = 'bold 40px "Archivo Black", Arial Black, sans-serif'; sg.fillText('♥ 72', 50, 80);
    sg.fillStyle = 'rgba(4,20,28,0.25)'; sg.fillRect(0, 0, 1280, 720);
  }
  return {
    scene, cam, heroes: { tela: panel }, focus: 17, luz: 'neutro',
    update(t, def, assets, vert, cx3 = 0) {
      dna.rotation.y = t * 0.35; if (vert) { scr.position.set(cx3 + 0.3, 7.3, -6.5); scr.rotation.y = -0.05; leg.visible = false; dna.position.set(cx3 + 3.3, 0, -9.5); }
      else { scr.position.set(5.3, 4.5, -6.2); scr.rotation.y = -0.3; leg.visible = true; dna.position.set(-7.6, 0, -8.5); }
      cam.position.set(0.4 + 0.25 * Math.sin(t * 0.18), 3.6 + 0.12 * Math.sin(t * 0.14), 17 - (def.aproximar || 0) * Math.min(t, 8) * 0.25); cam.lookAt(0.6, 3.0, -2);
      const src = def.tela && assets && ((assets.videos || {})[def.tela] || (assets.images || {})[def.tela]);
      if (src) { const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
        if (w && h) { const k = Math.max(1280 / w, 720 / h); sg.drawImage(src, (1280 - w * k) / 2, (720 - h * k) / 2, w * k, h * k); } }
      else ecg(t);
      screenT.needsUpdate = true; lastSrc = src;
    },
  };
}

const SETS = { arteria: setArteria, estudio: setEstudio };
export const SET_NAMES = Object.keys(SETS);

class SetLayer {
  constructor(style, quality) {
    this.style = style; this.quality = quality; this.canvas = cv(4, 4); this.sets = {}; this.size = [0, 0];
    const r = this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = style === 'A' ? 1.0 : 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = style === 'A' ? THREE.PCFShadowMap : THREE.VSMShadowMap;
    if (style === 'B') { const pm = new THREE.PMREMGenerator(r); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; }
  }
  get(name) {
    if (!this.sets[name]) { const S = (SETS[name] || SETS.arteria)(this.style); if (this.env) { S.scene.environment = this.env; S.scene.environmentIntensity = 0.32; } this.sets[name] = S; S.composer = null; }
    return this.sets[name];
  }
  composerFor(S, pw, ph) {
    if (S.composer && S.cw === pw && S.ch === ph) return S.composer;
    if (S.composer) { S.composer.renderTarget1.dispose(); S.composer.renderTarget2.dispose(); }
    const rt = new THREE.WebGLRenderTarget(pw, ph, { samples: 4, type: THREE.HalfFloatType });
    const c = new EffectComposer(this.r, rt); c.setSize(pw, ph); c.addPass(new RenderPass(S.scene, S.cam));
    if (this.style === 'B' && this.quality !== 'rapida') {
      const ao = new GTAOPass(S.scene, S.cam, pw, ph); ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.5, scale: 1.0, samples: 16, distanceFallOff: 1.0 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 }); ao.blendIntensity = 0.85; c.addPass(ao);
      S.bokeh = new BokehPass(S.scene, S.cam, { focus: S.focus, aperture: 0.00022, maxblur: 0.0065 }); c.addPass(S.bokeh);
      c.addPass(new UnrealBloomPass(new THREE.Vector2(pw, ph), 0.18, 0.4, 2.2));
    }
    c.addPass(new OutputPass()); S.composer = c; S.cw = pw; S.ch = ph; return c;
  }
  // view = { x0, y0, x1, y1 } em px do mundo 1920×1080 · pw, ph = pixels de saída
  draw(ctx, def, t, view, assets) {
    const S = this.get(def.cenario || 'arteria'); this.cx3 = view.vertical ? (((view.x0 + view.x1) / 2) / 1920 * 2 - 1) * 9.6 + 0.2 : 0; S.update(t, def, assets, !!view.vertical, this.cx3);
    RIM.color.value.setHex(S.luz === 'arteria' ? 0xffa0aa : 0x8fe6ff); RIM.strength.value = this.style === 'A' ? 0.5 : 0;
    const pw = Math.max(16, Math.round(view.pw)), ph = Math.max(16, Math.round(view.ph));
    if (pw !== this.size[0] || ph !== this.size[1]) { this.r.setSize(pw, ph, false); this.size = [pw, ph]; }
    const k = pw / (view.x1 - view.x0);
    S.cam.aspect = 1920 / 1080; S.cam.setViewOffset(1920 * k, 1080 * k, view.x0 * k, view.y0 * k, pw, ph); S.cam.updateProjectionMatrix();
    this.composerFor(S, pw, ph).render();
    ctx.drawImage(this.canvas, view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }
  // ponto 3D nomeado → px do mundo 1920×1080 (para rótulos com seta)
  anchor(def, name, t, assets, vert) {
    const S = this.get(def.cenario || 'arteria'), o = S.heroes[name]; if (!o) return null;
    S.update(t, def, assets, !!vert, vert ? (this.cx3 || 0) : 0); const cam = S.cam.clone(); cam.clearViewOffset(); cam.aspect = 1920 / 1080; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const p = new THREE.Vector3(); o.getWorldPosition(p); p.project(cam); return [(p.x + 1) / 2 * 1920, (1 - p.y) / 2 * 1080];
  }
}

/* ================= API para o motor ================= */
export function create(opts = {}) {
  const style = opts.estilo === 'A' ? 'A' : 'B';
  let sam = null, sets = null;
  return {
    style, version: VERSION,
    drawSam(ctx, st, o) { (sam || (sam = new SamLayer(style))).draw(ctx, st, o); },
    drawSet(ctx, def, t, view, assets) { (sets || (sets = new SetLayer(style, opts.qualidade))).draw(ctx, def, t, view, assets); },
    anchor(def, name, t, assets, vert) { return (sets || (sets = new SetLayer(style, opts.qualidade))).anchor(def, name, t, assets, vert); },
    setLight(def) { const fn = SETS[def && def.cenario]; return fn ? ({ arteria: 'arteria', estudio: 'neutro' })[def.cenario] : null; },
  };
}
export { EXPR as EXPR3D };
