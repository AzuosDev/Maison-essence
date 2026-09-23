// Captura o rodape do celular com os quatro acordeoes abertos.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { BROWSER, DIR, FRONTEND } from './env.mjs';

const require = createRequire(FRONTEND);
const WebSocket = require('ws');

const chrome = spawn(BROWSER, ['--remote-debugging-port=9335', '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--user-data-dir=${DIR}/open-profile`, 'about:blank'], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 60; i += 1) {
  try { wsUrl = (await (await fetch('http://127.0.0.1:9335/json/version')).json()).webSocketDebuggerUrl; break; } catch { await sleep(250); }
}

const socket = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
const pending = new Map();
let id = 0;
socket.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id) { const e = pending.get(m.id); pending.delete(m.id); m.error ? e.reject(new Error(m.error.message)) : e.resolve(m.result); } });
await new Promise((r) => socket.once('open', r));
const send = (method, params = {}, sessionId) => { id += 1; socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })); };

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const call = (m, p) => send(m, p, sessionId);

await call('Page.enable');
await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await call('Page.navigate', { url: 'http://localhost:5199/dev-preview.html#/sacola' });
await sleep(4000);

const r = await call('Runtime.evaluate', {
  expression: `(() => {
    const botoes = [...document.querySelectorAll('footer button[aria-expanded]')];
    botoes.forEach((b) => { if (b.getAttribute('aria-expanded') === 'false') b.click(); });
    const footer = document.querySelector('footer');
    const box = footer.getBoundingClientRect();
    const pequenos = [...footer.querySelectorAll('a,button')]
      .map((el) => { const r = el.getBoundingClientRect(); return { nome: el.className.toString().split(' ')[0], w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter((x) => x.w > 0 && (x.w < 40 || x.h < 40));
    return JSON.stringify({ abertos: botoes.length, topo: Math.round(box.top + window.scrollY), altura: Math.round(box.height), total: document.documentElement.scrollHeight, pequenos });
  })()`,
  returnByValue: true,
});
const info = JSON.parse(r.result.value);
console.log(JSON.stringify(info, null, 2));

await sleep(600);
const shot = await call('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: info.topo, width: 390, height: Math.min(info.altura, 2600), scale: 1 },
});
writeFileSync(`${DIR}/shots/rodape-aberto.png`, Buffer.from(shot.data, 'base64'));
console.log('ok');
socket.close();
chrome.kill();
process.exit(0);
