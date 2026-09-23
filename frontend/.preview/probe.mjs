// Mede um seletor na pagina do preview. Uso: node probe.mjs "<rota>" "<expr JS>"
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { BROWSER, DIR, FRONTEND } from './env.mjs';
const require = createRequire(FRONTEND);
const WebSocket = require('ws');
const chrome = spawn(BROWSER, ['--remote-debugging-port=9334','--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',`--user-data-dir=${DIR}/probe-profile`,'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 60; i++) { try { wsUrl = (await (await fetch('http://127.0.0.1:9334/json/version')).json()).webSocketDebuggerUrl; break; } catch { await sleep(250); } }
const socket = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
const pending = new Map(); let id = 0;
socket.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id) { const e = pending.get(m.id); pending.delete(m.id); m.error ? e.reject(new Error(m.error.message)) : e.resolve(m.result); } });
await new Promise((r) => socket.once('open', r));
const send = (method, params = {}, sessionId) => { id += 1; socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })); };
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const call = (m, p) => send(m, p, sessionId);
await call('Page.enable'); await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride', { width: Number(process.argv[4] ?? 1440), height: 900, deviceScaleFactor: 1, mobile: false });
await call('Page.navigate', { url: `http://localhost:5199/dev-preview.html#${process.argv[2]}` });
await sleep(4000);
const r = await call('Runtime.evaluate', { expression: process.argv[3], returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(r.result.value ?? r.result, null, 2));
socket.close(); chrome.kill(); process.exit(0);
