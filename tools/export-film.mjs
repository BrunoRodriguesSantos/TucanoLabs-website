// Exports the film (film.html) to an MP4, frame by frame.
// Every frame is a pure function of time, so the result is exact, not a screen recording.
//
//   node tools/export-film.mjs [output.mp4]
//
// Needs Google Chrome and ffmpeg. Override with CHROME=/path/to/chrome, FPS=30, WIDTH=1920, HEIGHT=1080.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || 'tucano-labs-film.mp4');
const chromePath = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fps = Number(process.env.FPS || 30), W = Number(process.env.WIDTH || 1920), H = Number(process.env.HEIGHT || 1080);
const work = mkdtempSync(join(process.env.EXPORT_TMP || tmpdir(), 'tucano-film-'));
const port = 9700 + Math.floor(Math.random() * 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--hide-scrollbars', `--window-size=${W},${H}`, `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(300); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(join(root, 'film.html')).href + '?clean&t=0' });
  await sleep(2500);
  await evaluate('document.fonts.ready.then(function () { return true; })');
  const length = await evaluate('TL.filmLength');
  const total = Math.round(length * fps);
  console.log(`Rendering ${total} frames (${length}s at ${fps}fps, ${W}x${H})`);
  for (let f = 0; f < total; f++) {
    await evaluate(`new Promise(function (r) { TL.hero.seek(${(f / fps).toFixed(5)}); requestAnimationFrame(function () { requestAnimationFrame(r); }); })`);
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 94 });
    writeFileSync(join(work, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(shot.result.data, 'base64'));
    if (f % 120 === 0) console.log(`  ${f}/${total}`);
  }
  ws.close();
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(work, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (ff.status !== 0) throw new Error('ffmpeg failed');
  console.log('Saved', out);
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(work, { recursive: true, force: true });
}
