/**
 * A passagem para o WhatsApp — o instante em que o pedido sai do site.
 *
 * Tudo o que o checkout faz existe para chegar aqui. Se esta entrega falha, o
 * pedido ficou gravado no banco e ninguem conversou: a dona ve um pedido
 * aparecer sem mensagem nenhuma, e o cliente acha que nao deu certo.
 *
 * ## Por que a aba precisa ser aberta antes da resposta
 *
 * `window.open` so e permitido durante o tratamento de um gesto do usuario.
 * O clique em "Finalizar" satisfaz essa condicao, mas o `POST /orders` leva
 * de meio segundo a tres no 4G do interior — e quando a promessa resolve, o
 * gesto ja acabou. O Safari do iOS bloqueia a abertura nesse ponto, e o
 * Chrome do Android faz o mesmo em parte dos casos.
 *
 * A saida e reservar a aba **dentro do clique**, ainda vazia, e so trocar o
 * endereco dela quando a resposta chegar. Trocar o endereco de uma aba que ja
 * e nossa nao e "abrir janela": nao ha bloqueio a aplicar.
 *
 * Tres desfechos, e os tres precisam estar cobertos:
 *
 * 1. A reserva funcionou: a aba vai para o `wa.me`.
 * 2. A reserva foi bloqueada mesmo dentro do clique (bloqueador de pop-up
 *    ligado no braco). Tentamos de novo com a URL de verdade e, se tambem
 *    falhar, navegamos na aba atual — o plano manda escolher entre a janela
 *    previamente aberta e a mesma aba, e aqui a segunda e a rede da primeira.
 * 3. O pedido falhou: a aba reservada e fechada. Uma aba em branco esquecida
 *    depois de um erro e a pior confirmacao possivel de que algo quebrou.
 *
 * ## A mensagem nao e montada aqui
 *
 * A URL vem inteira do servidor, com a mensagem ja gravada no pedido e ja
 * codificada. Este modulo nao concatena, nao escapa e nao acrescenta
 * parametro nenhum: ele recebe uma string e a entrega ao navegador. E o que
 * garante que a quebra de linha e o acento que chegam ao WhatsApp sao os
 * mesmos que ficaram no pedido — reescrever a codificacao aqui criaria uma
 * segunda versao do texto, e as duas divergiriam no primeiro ajuste.
 */

export interface WhatsappHandoff {
  /**
   * Leva a conversa para a aba reservada.
   *
   * URL vazia — a loja ainda nao cadastrou o numero — fecha a aba e nao
   * navega. A tela de confirmacao cobre esse caso com o codigo do pedido.
   */
  send: (url: string) => void;

  /** Nao ha o que enviar: fecha a aba antes que ela vire lixo na tela. */
  release: () => void;
}

/**
 * Reserva a aba. **Chame de dentro do tratador do clique**, nunca depois de
 * um `await`: e a sincronia com o gesto que faz o navegador permitir.
 */
export function reserveWhatsappTab(): WhatsappHandoff {
  const tab = openTab('');

  if (tab !== null) {
    announce(tab);
  }

  return {
    send: (url) => {
      if (url === '') {
        close(tab);

        return;
      }

      if (tab !== null && !tab.closed) {
        go(tab, url);

        return;
      }

      // A reserva nao existiu. Uma segunda tentativa ainda pode passar em
      // navegadores que contam o clique por mais tempo; a aba atual e o que
      // sobra, e e melhor do que um pedido sem conversa.
      if (openTab(url) === null) {
        window.location.assign(url);
      }
    },

    release: () => {
      close(tab);
    },
  };
}

/**
 * O que a aba reservada mostra enquanto o pedido esta sendo criado.
 *
 * Sem isto, o cliente ve uma aba branca aparecer do nada e, por um ou dois
 * segundos, nao sabe se ela e parte do que ele pediu ou um anuncio. A frase
 * responde a pergunta antes de ela ser feita.
 *
 * Escrito a mao e sem `<link>` nenhum: a aba nao carrega nada da aplicacao,
 * e um estilo que dependesse de requisicao chegaria depois do redirecionamento.
 */
const PLACEHOLDER = [
  '<!doctype html>',
  '<html lang="pt-BR"><head><meta charset="utf-8">',
  '<title>Abrindo o WhatsApp</title>',
  '<style>',
  'html{height:100%}',
  'body{margin:0;height:100%;display:grid;place-items:center;',
  'background:#faf7f2;color:#3a3a3a;',
  "font:400 1rem/1.6 'Jost',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
  'p{margin:0;padding:0 1.5rem;text-align:center}',
  '</style></head>',
  '<body><p>Abrindo a conversa com a loja...</p></body></html>',
].join('');

function announce(tab: Window): void {
  try {
    tab.document.write(PLACEHOLDER);
    tab.document.close();
  } catch {
    // Um navegador que recusa escrever no `about:blank` fica com a aba em
    // branco por um instante. E feio, e nao e motivo para o pedido falhar.
  }
}

/**
 * Abre e devolve o controle da aba.
 *
 * Sem `noopener`, e de proposito: o sinalizador faz `window.open` devolver
 * `null`, e e justamente o controle da aba que precisamos guardar para
 * redireciona-la depois. A ligacao de volta e cortada em `go`, antes da
 * navegacao.
 */
function openTab(url: string): Window | null {
  try {
    return window.open(url, '_blank');
  } catch {
    return null;
  }
}

/**
 * Manda a aba para a conversa, sem deixar o caminho de volta aberto.
 *
 * `opener = null` corta a referencia que a pagina aberta teria para esta —
 * o mesmo que `rel="noopener"` faz num link. Feito **antes** de navegar,
 * enquanto a aba ainda e `about:blank` e, portanto, acessivel.
 *
 * `replace` e nao `assign` para que a aba nova nao guarde um `about:blank`
 * no historico: o "voltar" dela nao tem para onde ir.
 */
function go(tab: Window, url: string): void {
  try {
    tab.opener = null;
  } catch {
    // Navegador que nao deixa mexer em `opener`. Segue: a navegacao importa
    // mais que o endurecimento.
  }

  try {
    tab.location.replace(url);
    tab.focus();
  } catch {
    window.location.assign(url);
  }
}

function close(tab: Window | null): void {
  try {
    if (tab !== null && !tab.closed) {
      tab.close();
    }
  } catch {
    // Aba que recusa fechar nao e problema de ninguem aqui.
  }
}
