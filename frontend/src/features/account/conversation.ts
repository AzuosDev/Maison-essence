/**
 * Reabrir a conversa sobre um pedido.
 *
 * ## Por que não reenviar a mensagem original
 *
 * O pedido guarda `whatsappMessage`: o texto inteiro, com itens e valores,
 * como foi mandado no dia em que fechou. A tela de confirmação reenvia
 * exatamente aquilo, e faz bem — ali o pedido acabou de nascer e a aba pode
 * ter sido bloqueada.
 *
 * Aqui e outra conversa. Quem abre o histórico semanas depois quer perguntar
 * *sobre* o pedido — onde esta, quando chega, se da para trocar. Colar a
 * lista de compras de novo no meio de uma conversa que já existe faria a
 * dona ler tudo outra vez procurando a pergunta. O código e o suficiente: e
 * por ele que ela acha o pedido no painel.
 *
 * ## O número vem das configurações da loja
 *
 * E não de uma constante. A loja pode trocar de número, e o dia em que
 * trocar não pode ser o dia em que o histórico inteiro passa a apontar para
 * um telefone que não existe mais. Sem número cadastrado a função devolve
 * string vazia, e quem chama não desenha o botão — um `wa.me/` sem número
 * abre uma página de erro do WhatsApp.
 */
export function conversationUrl(storeNumber: string, code: string): string {
  const digits = storeNumber.replace(/\D/g, '');

  if (digits === '') {
    return '';
  }

  const text = `Olá! Quero falar sobre o pedido ${code}.`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
