// Captura a loja de verdade (localhost:5173), desktop e celular na mesma rodada.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { BROWSER, DIR, FRONTEND } from './env.mjs';

const require = createRequire(FRONTEND);
const WebSocket = require('ws');
const out = `${DIR}/shots/real`;
mkdirSync(out, { recursive: true });

const chrome = spawn(BROWSER, ['--remote-debugging-port=9336', '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--user-data-dir=${DIR}/real-profile`, 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 60; i += 1) {
  try { wsUrl = (await (await fetch('http://127.0.0.1:9336/json/version')).json()).webSocketDebuggerUrl; break; } catch { await sleep(250); }
}
const socket = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
const pending = new Map();
let id = 0;
socket.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id) { const e = pending.get(m.id); pending.delete(m.id); m.error ? e.reject(new Error(m.error.message)) : e.resolve(m.result); } });
await new Promise((r) => socket.once('open', r));
const send = (method, params = {}, sessionId) => { id += 1; socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })); };

for (const view of [
  { label: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
  { label: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
]) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (m, p) => send(m, p, sessionId);

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: view.scale, mobile: view.mobile });
  if (view.mobile) await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await call('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(6000);
  await call('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 800))))', awaitPromise: true });

  const info = await call('Runtime.evaluate', {
    expression: `(() => {
      const hero = document.querySelector('[class*=home-hero-module__hero]');
      const media = document.querySelector('[class*=mediaWide]');
      const card = document.querySelector('[class*=product-card-module__card]');
      const box = media ? media.getBoundingClientRect() : null;
      return JSON.stringify({
        heroBottom: hero ? Math.round(hero.getBoundingClientRect().bottom) : null,
        banner: box ? Math.round(box.width) + 'x' + Math.round(box.height) : 'sem mediaWide',
        proporcao: box ? (box.width / box.height).toFixed(4) : null,
        cardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
        viewport: window.innerHeight,
        altura: document.documentElement.scrollHeight,
      });
    })()`,
    returnByValue: true,
  });
  console.log(view.label, info.result.value);

  const total = JSON.parse(info.result.value).altura;
  const band = 1400;
  for (let s = 0; s < Math.min(3, Math.ceil(total / band)); s += 1) {
    const shot = await call('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: s * band, width: view.width, height: Math.min(band, total - s * band), scale: 1 },
    });
    writeFileSync(`${out}/${view.label}-${s + 1}.png`, Buffer.from(shot.data, 'base64'));
  }
}

socket.close();
chrome.kill();
process.exit(0);
