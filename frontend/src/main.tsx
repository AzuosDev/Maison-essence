import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
/*
 * As duas familias do design system, servidas pelo proprio site.
 *
 * Vinham do Google Fonts, e o `<link>` de la bloqueava a primeira pintura:
 * o navegador abria conexao com dois dominios de fora antes de desenhar
 * qualquer coisa, perto de um segundo num celular. Daqui elas entram no CSS
 * do proprio bundle, pelo mesmo dominio e com `font-display: swap`.
 *
 * **Onest e a voz da loja** — titulo de secao, nome de produto, preco, botao,
 * menu, formulario. Quatro pesos, porque a vitrine usa os quatro: 400 no
 * corpo, 500 no rotulo, 600 no nome e no titulo, 700 no preco e no selo.
 *
 * A **Cormorant** sobrou para um uso so, a assinatura da marca ao lado do
 * monograma, e por isso baixa um peso unico. Ela nao titula mais nada: numa
 * loja que precisa dizer preco, condicao e disponibilidade, a serifada de
 * alto contraste atrapalhava a leitura rapida que a vitrine pede.
 *
 * So o subconjunto latino: ele cobre os acentos do portugues.
 */
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/onest/latin-700.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import './styles/global.css';

/**
 * O ponto de entrada.
 *
 * A aplicação entra por `import()`, e não por import estático no topo, por um
 * motivo só: a validação das variáveis de ambiente (`lib/env.ts`) falha na
 * avaliação do módulo, antes de React existir. Com import estático, essa
 * falha aconteceria antes desta linha rodar e o resultado seria uma página
 * branca com um erro no console — justamente no cenário em que a mensagem
 * ("falta VITE_API_URL") e tudo o que quem esta publicando precisa ler.
 *
 * Com o import dinâmico dentro do `try`, o erro de configuração vira um
 * recado na tela.
 */
async function bootstrap(): Promise<void> {
  const container = document.getElementById('root');

  if (!container) {
    throw new Error('O elemento #root não existe no index.html.');
  }

  try {
    const { App } = await import('./app/App');

    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    renderBootFailure(container, error);
  }
}

/**
 * A tela de falha de boot.
 *
 * Escrita em DOM puro de propósito: se o que falhou foi carregar a
 * aplicação, não da para contar com componente nenhum dela para contar isso.
 */
function renderBootFailure(container: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  console.error('A aplicação não subiu', error);

  container.innerHTML = '';

  const wrapper = document.createElement('div');

  wrapper.style.cssText = [
    'max-width:48rem',
    'margin:4rem auto',
    'padding:0 1rem',
    'font-family:Onest,system-ui,sans-serif',
    'color:#4A4A4A',
  ].join(';');

  const title = document.createElement('h1');

  title.textContent = 'A loja não conseguiu iniciar';
  title.style.cssText = 'font-family:"Cormorant Garamond",Georgia,serif;color:#121212';

  const detail = document.createElement('pre');

  // `textContent`, nunca `innerHTML`: a mensagem pode conter o que veio do
  // ambiente, e um erro não e lugar para executar markup.
  detail.textContent = message;
  detail.style.cssText = [
    'margin-top:1rem',
    'padding:1rem',
    'background:#F3F0EA',
    'border-radius:4px',
    'white-space:pre-wrap',
    'font-size:.875rem',
  ].join(';');

  wrapper.append(title, detail);
  container.append(wrapper);
}

void bootstrap();
