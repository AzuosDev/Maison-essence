import type { HelmetOptions } from 'helmet';

/**
 * Meio ano de HSTS, com os subdominios juntos.
 *
 * O cabeçalho manda o navegador nunca mais falar com este host em texto claro,
 * e vale até expirar — por isso o prazo e longo o bastante para significar
 * alguma coisa e a lista de precarga fica de fora: entrar nela e fácil e sair
 * demora meses.
 */
const HSTS_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/**
 * Cabeçalhos de segurança da API.
 *
 * A API não serve página: toda resposta e JSON. Então a política de conteúdo
 * pode ser a mais fechada que existe — nada pode ser carregado, nada pode ser
 * executado, e a resposta não pode ser colocada dentro de um quadro. Isso não
 * protege o JSON em si; protege o navegador de alguém que descubra um jeito de
 * fazer a API devolver HTML e de servi-lo a partir do domínio da loja.
 *
 * `crossOriginResourcePolicy` fica em `cross-origin` porque e exatamente isso
 * que esta API e: a loja e o painel rodam em outros domínios da Vercel e
 * precisam poder ler as respostas. O padrão do helmet (`same-origin`) e para
 * quem serve o próprio site.
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
    // e uma página, e executa-lá.
    noSniff: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  };
}

/**
 * A mesma política, afrouxada no tanto que a documentação precisa.
 *
 * O Swagger UI e uma página de verdade: ela carrega o próprio script e a
 * própria folha de estilo, e escreve estilo em linha. Nada disso pode valer
 * para o resto da API, e por isso a exceção e montada em cima do caminho da
 * documentação, e não acrescentada a política geral.
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
