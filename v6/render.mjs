// Render headless do Sam Studio v6: node render.mjs <pasta_do_episodio> <saida.mp4> [--frames t1,t2,...] [--formato 9x16]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const dir = path.resolve(args[0]);
const out = args[1];
const framesArg = args.includes('--frames') ? args[args.indexOf('--frames') + 1].split(',').map(Number) : null;
const fmtOverride = args.includes('--formato') ? args[args.indexOf('--formato') + 1] : null;
const studioDir = path.dirname(new URL(import.meta.url).pathname);

const ep = JSON.parse(fs.readFileSync(path.join(dir, 'episode.json'), 'utf8'));
if (fmtOverride) ep.formato = fmtOverride;
const timing = JSON.parse(fs.readFileSync(path.join(dir, 'timing.json'), 'utf8'));
const imgs = {};
for (const sc of ep.cenas) if (sc.fundo && !imgs[sc.fundo]) {
  const p = fs.existsSync(path.join(dir, sc.fundo)) ? path.join(dir, sc.fundo) : path.join(dir, '..', 'assets', sc.fundo);
  imgs[sc.fundo] = 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64');
}
const font = f => fs.readFileSync(f).toString('base64');
const fontsCss = `
@font-face{font-family:"Anton";src:url(data:font/ttf;base64,${font('/usr/share/fonts/truetype/google-fonts/ofl/anton/Anton-Regular.ttf')}) format("truetype");}
@font-face{font-family:"Archivo Black";src:url(data:font/ttf;base64,${font('/usr/share/fonts/truetype/google-fonts/ofl/archivoblack/ArchivoBlack-Regular.ttf')}) format("truetype");}`;
const engine = fs.readFileSync(path.join(studioDir, 'sam-engine.js'), 'utf8');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-proxy-server', '--disable-gpu', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontsCss}</style></head><body><canvas id="c"></canvas><script>${engine}</script></body></html>`);
await page.evaluate(async () => { await Promise.all([document.fonts.load('40px "Anton"'), document.fonts.load('40px "Archivo Black"'), document.fonts.load('bold 40px "DejaVu Sans"')]); });
const info = await page.evaluate(async ({ ep, imgs, boca }) => {
  const images = {};
  await Promise.all(Object.entries(imgs).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { images[k] = im; res(); }; im.src = src; })));
  const cv = document.getElementById('c');
  window.R = SamEngine.create(cv, ep, { images, boca });
  window.CV = cv;
  return { warnings: R.warnings, duration: R.duration, fps: R.fps, W: cv.width, H: cv.height };
}, { ep, imgs, boca: timing.boca });
console.log('avisos do catálogo:', info.warnings.length ? info.warnings : 'zero ✓');

const grab = async t => {
  const b64 = await page.evaluate(t => { R.renderAt(t); return CV.toDataURL('image/jpeg', 0.94).split(',')[1]; }, t);
  return Buffer.from(b64, 'base64');
};
if (framesArg) {
  fs.mkdirSync(out, { recursive: true });
  for (const t of framesArg) fs.writeFileSync(path.join(out, `f_${t.toFixed(2)}.jpg`), await grab(t));
  console.log('quadros salvos em', out);
} else {
  const n = Math.round(info.duration * info.fps);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(info.fps), '-i', '-',
    '-i', path.join(dir, 'mix.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await grab(i / info.fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`quadro ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('vídeo pronto:', out, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
