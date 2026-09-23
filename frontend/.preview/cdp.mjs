// Capturador de tela via CDP. Uso:
//   node cdp.mjs <tag> [rota:nome ...]
// Sobe o Chrome com porta de depuracao, emula desktop e celular de verdade
// (device metrics + touch) e devolve pagina inteira mais um relatorio de
// medidas: largura de rolagem, overflow horizontal e alvos de toque.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/felip/OneDrive/Documentos/Meus Projetos/Maison-essence/frontend/');
const WebSocket = require('ws');

const DIR = 'C:/Users/felip/AppData/Local/Temp/claude/c--Users-felip-OneDrive-Documentos-Meus-Projetos-Maison-essence/6191bae7-8fa1-466c-ae81-41a89467b77d/scratchpad';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5199/dev-preview.html';
const PORT = 9333;

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
  { label: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
];

const tag = process.argv[2] ?? 'depois';
const targets = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['home:/', 'produtos:/produtos', 'produto:/produtos/oud-royale-intense', 'categoria:/categorias/perfumes-masculinos', 'sacola:/sacola'];

const out = `${DIR}/shots/${tag}`;
mkdirSync(out, { recursive: true });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  '--disable-extensions',
  '--hide-scrollbars',
  `--user-data-dir=${DIR}/cdp-profile`,
  'about:blank',
], { stdio: 'ignore' });

async function endpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('O Chrome nao abriu a porta de depuracao.');
}

const browserUrl = await endpoint();

function connect(url) {
  const socket = new WebSocket(url, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
  const pending = new Map();
  const events = [];
  let id = 0;

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id !== undefined) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    } else {
      events.push(message);
    }
  });

  const ready = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  return {
    ready,
    events,
    close: () => socket.close(),
    send(method, params = {}, sessionId) {
      id += 1;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      socket.send(JSON.stringify(payload));

      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
}

const browser = connect(browserUrl);
await browser.ready;

const report = [];

for (const target of targets) {
  const name = target.slice(0, target.indexOf(':'));
  const route = target.slice(target.indexOf(':') + 1);

  for (const view of VIEWPORTS) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => browser.send(method, params, sessionId);

    await call('Page.enable');
    await call('Runtime.enable');
    await call('Emulation.setDeviceMetricsOverride', {
      width: view.width,
      height: view.height,
      deviceScaleFactor: view.scale,
      mobile: view.mobile,
    });
    if (view.mobile) {
      await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    }

    await call('Page.navigate', { url: `${BASE}#${route}` });
    await sleep(3500);

    // Espera as fontes e as imagens acima da dobra assentarem.
    await call('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 400))))',
      awaitPromise: true,
    });

    const probe = await call('Runtime.evaluate', {
      expression: `(() => {
        const doc = document.documentElement;
        const overflow = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 0 && box.right > doc.clientWidth + 1;
          })
          .slice(0, 8)
          .map((el) => el.tagName.toLowerCase() + '.' + (el.className.toString().split(' ')[0] || '?') + ' right=' + Math.round(el.getBoundingClientRect().right));
        const small = [...document.querySelectorAll('a,button,input,select')]
          .filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 0 && (box.height < 40 || box.width < 40);
          })
          .slice(0, 10)
          .map((el) => el.tagName.toLowerCase() + '.' + (el.className.toString().split(' ')[0] || '?') + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
        return JSON.stringify({
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          scrollHeight: doc.scrollHeight,
          overflow,
          small,
        });
      })()`,
      returnByValue: true,
    });

    report.push({ name, view: view.label, ...JSON.parse(probe.result.value) });

    // Fatias de uma altura legivel: a pagina inteira em um PNG so fica
    // pequena demais para julgar espacamento.
    const total = JSON.parse(probe.result.value).scrollHeight;
    const band = 1400;
    const slices = Math.min(9, Math.ceil(total / band));

    for (let s = 0; s < slices; s += 1) {
      const shot = await call('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: s * band,
          width: view.width,
          height: Math.min(band, total - s * band),
          scale: 1,
        },
      });

      writeFileSync(`${out}/${name}-${view.label}-${s + 1}.png`, Buffer.from(shot.data, 'base64'));
    }

    console.log(`  ${name}-${view.label}: ${slices} fatias de ${total}px`);

    await browser.send('Target.closeTarget', { targetId });
  }
}

writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

browser.close();
chrome.kill();
process.exit(0);
