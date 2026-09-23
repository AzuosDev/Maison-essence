// Onde a bancada esta rodando: pasta de saida, navegador e raiz do frontend.
//
// Existe porque `cdp.mjs` e `probe.mjs` nasceram com esses tres caminhos
// escritos a mao no topo, e trocar de maquina virava uma edicao nos dois
// arquivos. Aqui a resolucao e por ambiente, com sobrescrita por variavel:
//
//   PREVIEW_DIR      onde gravar capturas e perfis do navegador
//   PREVIEW_BROWSER  o executavel Chromium a usar
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// `.preview/` fica na raiz do frontend, e e de la que sai o `node_modules`
// com o `ws` — o `createRequire` precisa de um caminho de diretorio, com a
// barra no fim, senao ele resolve a partir do pai.
export const FRONTEND = `${resolve(dirname(fileURLToPath(import.meta.url)), '..').replaceAll('\\', '/')}/`;

export const DIR = (process.env.PREVIEW_DIR ?? join(tmpdir(), 'maison-preview')).replaceAll('\\', '/');
mkdirSync(DIR, { recursive: true });

/*
 * Qualquer Chromium serve: o protocolo de depuracao e o mesmo. Edge esta
 * instalado em toda maquina Windows e e o fallback que evita depender de uma
 * instalacao de Chrome que pode nao existir.
 */
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export const BROWSER = process.env.PREVIEW_BROWSER ?? CANDIDATES.find((path) => existsSync(path));

if (!BROWSER) {
  throw new Error('Nenhum Chromium encontrado. Defina PREVIEW_BROWSER com o caminho do executavel.');
}
