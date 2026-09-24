import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
    'font-family:Jost,system-ui,sans-serif',
    'color:#3A3A3A',
  ].join(';');

  const title = document.createElement('h1');

  title.textContent = 'A loja não conseguiu iniciar';
  title.style.cssText = 'font-family:"Cormorant Garamond",Georgia,serif;color:#0E0E0E';

  const detail = document.createElement('pre');

  // `textContent`, nunca `innerHTML`: a mensagem pode conter o que veio do
  // ambiente, e um erro não e lugar para executar markup.
  detail.textContent = message;
  detail.style.cssText = [
    'margin-top:1rem',
    'padding:1rem',
    'background:#F1E9DD',
    'border-radius:4px',
    'white-space:pre-wrap',
    'font-size:.875rem',
  ].join(';');

  wrapper.append(title, detail);
  container.append(wrapper);
}

void bootstrap();
