/**
 * Reabrir a conversa sobre um pedido.
 *
 * ## Por que nao reenviar a mensagem original
 *
 * O pedido guarda `whatsappMessage`: o texto inteiro, com itens e valores,
 * como foi mandado no dia em que fechou. A tela de confirmacao reenvia
 * exatamente aquilo, e faz bem — ali o pedido acabou de nascer e a aba pode
 * ter sido bloqueada.
 *
 * Aqui e outra conversa. Quem abre o historico semanas depois quer perguntar
 * *sobre* o pedido — onde esta, quando chega, se da para trocar. Colar a
 * lista de compras de novo no meio de uma conversa que ja existe faria a
 * dona ler tudo outra vez procurando a pergunta. O codigo e o suficiente: e
 * por ele que ela acha o pedido no painel.
 *
 * ## O numero vem das configuracoes da loja
 *
 * E nao de uma constante. A loja pode trocar de numero, e o dia em que
 * trocar nao pode ser o dia em que o historico inteiro passa a apontar para
 * um telefone que nao existe mais. Sem numero cadastrado a funcao devolve
 * string vazia, e quem chama nao desenha o botao — um `wa.me/` sem numero
 * abre uma pagina de erro do WhatsApp.
 */
export function conversationUrl(storeNumber: string, code: string): string {
  const digits = storeNumber.replace(/\D/g, '');

  if (digits === '') {
    return '';
  }

  const text = `Ola! Quero falar sobre o pedido ${code}.`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
