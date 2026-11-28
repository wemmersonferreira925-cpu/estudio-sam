// Render headless do Sam Studio v7 a partir de um ROTEIRO (o mesmo que o Grok escreve):
//   node render7.mjs <pasta> <saida.mp4|pasta_quadros> [--formato 9x16] [--frames 1,2.5,…] [--estilo A|B]
// A pasta tem roteiro.json e os arquivos que ele cita (voz, imagens, vídeos).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2), dir = path.resolve(args[0]), out = args[1];
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const fmt = opt('--formato'), framesArg = opt('--frames') ? opt('--frames').split(',').map(Number) : null, estilo = opt('--estilo') || null;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rot = JSON.parse(fs.readFileSync(path.join(dir, 'roteiro.json'), 'utf8'));
if (fmt) rot.formato = fmt; if (estilo) rot.estilo3d = estilo;
const b64 = f => fs.readFileSync(f).toString('base64');
const voz = rot.voz && fs.existsSync(path.join(dir, rot.voz)) ? b64(path.join(dir, rot.voz)) : null;
const gab = fs.existsSync(path.join(dir, 'gabarito.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'gabarito.json'), 'utf8')) : null;
const css = `@font-face{font-family:"Anton";src:url(data:font/ttf;base64,${b64('/usr/share/fonts/truetype/google-fonts/ofl/anton/Anton-Regular.ttf')}) format("truetype");}
@font-face{font-family:"Archivo Black";src:url(data:font/ttf;base64,${b64('/usr/share/fonts/truetype/google-fonts/ofl/archivoblack/ArchivoBlack-Regular.ttf')}) format("truetype");}`;
const js = f => fs.readFileSync(path.join(root, 'studio', f), 'utf8');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-proxy-server', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
const logs = []; page.on('pageerror', e => logs.push('ERRO: ' + e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><canvas id="c"></canvas>
<script>${js('sam3d.bundle.js')}</script><script>${js('sam-engine.js')}</script><script>${js('audio-v7.js')}</script></body></html>`);
await page.evaluate(async () => { await Promise.all([document.fonts.load('40px "Anton"'), document.fonts.load('40px "Archivo Black"'), document.fonts.load('bold 40px "DejaVu Sans"')]); });
const info = await page.evaluate(async ({ rot, voz, gab }) => {
  const ac = new OfflineAudioContext(1, 48000, 48000);
  let vozBuf = null; if (voz) { const bin = Uint8Array.from(atob(voz), c => c.charCodeAt(0)); vozBuf = await ac.decodeAudioData(bin.buffer); }
  const est = SamEngine.estimarPalavras(rot.blocos, rot.ritmo || 1);
  const words = vozBuf ? SamEngine.alinharPalavras(est, SamEngine.envelope(vozBuf.getChannelData(0), vozBuf.sampleRate, 100), 100) : est;
  const { ep, warns } = SamEngine.compilarRoteiro(rot, words);
  const boca = vozBuf ? SamAudio.boca(vozBuf, ep.fps, ep.duracao) : SamEngine.bocaDePalavras(words, ep.fps, ep.duracao);
  const cv = document.getElementById('c');
  window.R = SamEngine.create(cv, ep, { images: {}, videos: {}, boca, estilo3d: rot.estilo3d || 'A' }); window.CV = cv; window.EP = ep;
  const mixed = await SamAudio.mix({ voz: vozBuf, sfx: ep.sfx, dur: ep.duracao });
  const wav = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(SamAudio.toWav(mixed)); });
  // conferência do alinhamento contra o gabarito (início real de cada bloco)
  let erro = null; if (gab) { const firsts = rot.blocos.map((b, i) => (words.find(w => w.b === i) || {}).t0); erro = firsts.map((t, i) => +(t - gab.inicio_blocos[i]).toFixed(2)); }
  return { warns: warns.concat(R.warnings), duration: R.duration, fps: R.fps, W: cv.width, H: cv.height, wav, lufs: mixed.lufs, erro, sam3d: R.sam3d, nsfx: ep.sfx.length, cenas: ep.cenas.length };
}, { rot, voz, gab });
console.log('avisos:', info.warns.length ? info.warns : 'zero ✓'); console.log('sam3d:', info.sam3d, '· cenas:', info.cenas, '· sfx:', info.nsfx, '· loudness:', info.lufs.toFixed(1), 'LUFS · duração:', info.duration);
if (info.erro) console.log('erro do alinhamento por bloco (s):', info.erro.join(' '));
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
const wavPath = path.join('/tmp', 'mix-' + process.pid + '.wav'); fs.writeFileSync(wavPath, Buffer.from(info.wav, 'base64'));
const grab = async t => Buffer.from(await page.evaluate(t => { R.renderAt(t); return CV.toDataURL('image/jpeg', 0.93).split(',')[1]; }, t), 'base64');
if (framesArg) {
  fs.mkdirSync(out, { recursive: true });
  for (const t of framesArg) { const t0 = Date.now(); fs.writeFileSync(path.join(out, `f_${t.toFixed(2)}.jpg`), await grab(t)); console.log('quadro', t, Date.now() - t0, 'ms'); }
} else {
  const n = Math.round(info.duration * info.fps);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(info.fps), '-i', '-', '-i', wavPath, '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) { const buf = await grab(i / info.fps); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`quadro ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('vídeo pronto:', out, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
