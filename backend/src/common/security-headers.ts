import type { HelmetOptions } from 'helmet';

/**
 * Meio ano de HSTS, com os subdominios juntos.
 *
 * O cabecalho manda o navegador nunca mais falar com este host em texto claro,
 * e vale ate expirar — por isso o prazo e longo o bastante para significar
 * alguma coisa e a lista de precarga fica de fora: entrar nela e facil e sair
 * demora meses.
 */
const HSTS_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/**
 * Cabecalhos de seguranca da API.
 *
 * A API nao serve pagina: toda resposta e JSON. Entao a politica de conteudo
 * pode ser a mais fechada que existe — nada pode ser carregado, nada pode ser
 * executado, e a resposta nao pode ser colocada dentro de um quadro. Isso nao
 * protege o JSON em si; protege o navegador de alguem que descubra um jeito de
 * fazer a API devolver HTML e de servi-lo a partir do dominio da loja.
 *
 * `crossOriginResourcePolicy` fica em `cross-origin` porque e exatamente isso
 * que esta API e: a loja e o painel rodam em outros dominios da Vercel e
 * precisam poder ler as respostas. O padrao do helmet (`same-origin`) e para
 * quem serve o proprio site.
 */
export function apiSecurityHeaders(): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
        'frame-ancestors': ["'none'"],
      },
    },
    hsts: { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true, preload: false },
    // `nosniff`: sem ele, o navegador pode decidir que um JSON com HTML dentro
    // e uma pagina, e executa-la.
    noSniff: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  };
}

/**
 * A mesma politica, afrouxada no tanto que a documentacao precisa.
 *
 * O Swagger UI e uma pagina de verdade: ela carrega o proprio script e a
 * propria folha de estilo, e escreve estilo em linha. Nada disso pode valer
 * para o resto da API, e por isso a excecao e montada em cima do caminho da
 * documentacao, e nao acrescentada a politica geral.
 */
export function docsSecurityHeaders(): HelmetOptions {
  return {
    ...apiSecurityHeaders(),
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
      },
    },
  };
}
