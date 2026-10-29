/**
 * O texto que a loja já nasce dizendo.
 *
 * Quem somos, como comprar, modo de uso, trocas e devoluções, perguntas
 * frequentes e privacidade são textos que não dependem de banco nenhum para
 * existir: são a política da loja e a sua apresentação. Ficam aqui, em
 * Markdown, e entram como conteúdo padrão das páginas institucionais (ver
 * `DEFAULT_INSTITUTIONAL_PAGES`).
 *
 * ## As duas últimas descrevem o sistema, e não a vontade da loja
 *
 * "Como comprar" e a privacidade saíram do código, passo por passo: as
 * quatro etapas do checkout, o que o `CreateOrderDto` de fato pede, o que o
 * navegador guarda sozinho, os cookies de sessão da conta e o fato de que
 * nenhum pagamento e processado aqui. Mudar o fluxo do pedido sem mudar
 * estes dois textos os transforma em promessa falsa — que e o defeito que o
 * princípio "promessa só quando e verdade" existe para evitar.
 *
 * Padrão, e não valor fixo: no instante em que a dona salva uma destas
 * páginas no painel, o que ela escreveu passa a valer e este arquivo deixa de
 * ser lido para aquela página (ver `mergeInstitutionalPages`). O lugar de
 * corrigir uma vírgula continua sendo o painel; este arquivo e só o ponto de
 * partida, para que a loja não suba com a aba de trocas em branco.
 *
 * O `#` de cada seção e o primeiro nível de título, e não um `h1`: quem
 * renderiza e `lib/markdown` no frontend, que desloca os títulos para o nível
 * em que o texto esta sendo lido — `h3` nas abas do produto, `h2` na página
 * institucional, onde o `h1` e o título da página.
 */

export const ABOUT_CONTENT = `A Maison Essence nasceu de um sonho, da coragem de começar pequeno e da paixão pelo universo da perfumaria. O que começou com poucos produtos e muita dedicação hoje se transforma em uma marca que transmite elegância, autoestima e experiências através dos perfumes árabes originais.

Nossa essência está em oferecer fragrâncias marcantes, qualidade, autenticidade e um atendimento especial, construindo uma história de fé, dedicação e carinho com as nossas cheirosas.

Mais do que perfumes, queremos proporcionar experiências, despertar emoções e revelar identidades, porque acreditamos que uma fragrância é capaz de marcar momentos e criar memórias inesquecíveis.
`;

export const HOW_TO_BUY_CONTENT = `Comprar na Maison Essence leva poucos minutos e termina numa conversa com a gente no WhatsApp, onde o pagamento e a entrega são combinados.

# Passo a passo

1. **Escolha os produtos.** Use a busca ou as categorias e clique em "Adicionar" no produto que você quer. Quando a fragrância tem mais de um tamanho, escolha o tamanho antes de adicionar.
2. **Confira a sacola.** Ali aparecem o valor de cada item, o desconto por quantidade, quando houver, e quanto falta para o frete grátis.
3. **Diga como quer receber.** Escolha entre a entrega na sua cidade ou a retirada combinada em Juazeiro do Norte. Na entrega, o frete é calculado pela cidade e aparece antes de você fechar o pedido.
4. **Escolha a forma de pagamento.** PIX ou cartão, com as condições de parcelamento que aparecem na tela. Nenhum pagamento é cobrado pelo site: a escolha fica registrada no pedido e acertamos com você no WhatsApp.
5. **Revise e finalize.** A última etapa mostra os itens, o endereço, o frete e o total. Ao finalizar, o pedido é gravado e o WhatsApp abre com o resumo dele já escrito.
6. **Combine o resto com a gente.** Confirmamos a disponibilidade, passamos os dados do pagamento e combinamos o envio ou a retirada.

# Preciso criar uma conta?

Não. Você pode fechar o pedido como visitante, informando nome e telefone — o e-mail é opcional.

Criar uma conta serve para guardar os seus endereços e ver os pedidos que você já fez, sem precisar digitar tudo de novo na próxima compra.

# Como acompanhar o pedido

Todo pedido recebe um código, que aparece na tela de confirmação e também na mensagem do WhatsApp. Guarde esse código: é por ele que a gente localiza a sua compra na conversa.

# Se algo não funcionar

Se a página travar, se o WhatsApp não abrir ou se você tiver qualquer dúvida no meio do caminho, fale com a gente pelo WhatsApp ou pelo e-mail que estão no rodapé do site. O atendimento é feito pela própria loja, uma pessoa de cada vez.
`;

export const USAGE_CONTENT = `# Como usar o perfume

- Aplique nas áreas de maior circulação sanguínea, como pescoço, pulsos e atrás das orelhas.
- Mantenha uma distância de 10 a 15 cm da pele para uma distribuição melhor.
- Evite esfregar o perfume depois de aplicar: isso pode alterar a fragrância.
- Para maior durabilidade, aplique sobre a pele hidratada.

# Como armazenar o perfume

- Guarde em local fresco, seco e longe da luz solar direta.
- Evite deixar no banheiro: calor e umidade podem alterar a fragrância.
- Mantenha sempre bem fechado e, se possível, na caixa original.
- Evite a exposição a altas temperaturas, para preservar a qualidade do perfume.
`;

export const RETURNS_CONTENT = `# Regras para trocas e devoluções

- O produto deve estar lacrado, na embalagem original e sem indícios de uso.
- As solicitações devem ser feitas em até 7 dias corridos após o recebimento, respeitando o Código de Defesa do Consumidor.
- Em caso de defeito, vazamento ou divergência no pedido, podemos pedir fotos e vídeos para avaliação.

# Situações em que a troca ou a devolução é aceita

- **Produto com defeito:** vazamento, embalagem danificada ou falha no borrifador.
- **Pedido incorreto:** o item recebido é diferente do que foi comprado.

# Como solicitar

1. Entre em contato pelo WhatsApp ou pelo e-mail, informando o número do pedido e o motivo da solicitação.
2. Envie fotos ou vídeos do produto, quando necessário.
3. A nossa equipe faz a análise em até 48 horas úteis.
4. Depois da aprovação, enviamos as orientações para o envio do produto.
5. Assim que o item chegar e for conferido, fazemos a troca ou o reembolso, conforme o caso.

# Reembolso e créditos

- O reembolso pode ser feito por PIX, por estorno no cartão ou em forma de vale-compras.
- Quando o defeito ou o erro é confirmado, os custos de envio e de reenvio ficam por conta da loja.
- Não fazemos trocas nem reembolsos por preferência pessoal ou por escolha equivocada da fragrância, ressalvados os direitos previstos na legislação aplicável.

# Alterações nas fragrâncias

Os fabricantes podem ajustar e reformular as suas fragrâncias ao longo do tempo, o que às vezes muda o aroma. Essas alterações acontecem por regulamentação, por disponibilidade de matérias-primas ou por decisão do próprio fabricante.

A Maison Essence não é responsável por reformulações feitas pelas marcas fabricantes. Ainda assim, as solicitações relacionadas a essas mudanças são analisadas conforme a legislação aplicável e as condições de cada caso.
`;

export const FAQ_CONTENT = `# Os perfumes são originais?

Sim! Trabalhamos exclusivamente com perfumes originais e autênticos, garantindo procedência, qualidade e confiança em cada fragrância.

# Os perfumes são importados?

Sim. A nossa seleção conta com perfumes importados, especialmente as fragrâncias árabes, que se destacam pela sofisticação, pela personalidade e pelos aromas marcantes.

# Os perfumes têm boa fixação e projeção?

Sim! Muitos perfumes árabes são conhecidos pela excelente fixação e pela projeção marcante. O desempenho varia conforme a fragrância, o tipo de pele, o clima e a forma de aplicação.

# Quanto tempo o perfume dura na pele?

A duração varia conforme a fragrância e as características da pele. Em geral, muitos perfumes árabes permanecem de 6 a 12 horas, ou até mais, dependendo da composição e das condições de uso. Na roupa, a fragrância pode durar ainda mais.
`;

export const PRIVACY_CONTENT = `Esta política explica quais dados a Maison Essence pede, por que pede e o que fazemos com eles. Ela vale para o site da loja e para o atendimento que continua no WhatsApp.

# Quais dados pedimos

- **Para fechar um pedido:** nome, telefone e, se você quiser, e-mail. Na entrega, também o endereço — rua, número, complemento, bairro, cidade, CEP e ponto de referência.
- **Para criar uma conta:** nome, telefone, e-mail e uma senha, que fica guardada criptografada e não pode ser lida nem por nós. Os endereços que você salvar ficam junto da conta.
- **Do pedido em si:** os produtos escolhidos, as quantidades, o frete, o total e a forma de pagamento que você marcou.

Não pedimos CPF, número de cartão ou qualquer dado de pagamento no site.

# O que fica só no seu navegador

Algumas coisas são guardadas no seu próprio aparelho e não chegam até nós: os itens da sacola, o que você já preencheu no checkout, a cidade de entrega escolhida, as suas buscas recentes, a escolha entre tema claro e escuro e os pedidos que você já fez neste navegador.

Limpar os dados do navegador apaga tudo isso.

# Para que usamos

- Separar, cobrar e entregar o seu pedido.
- Falar com você sobre a compra pelo WhatsApp.
- Atender pedidos de troca, devolução ou garantia.
- Cumprir obrigações legais e fiscais.

Não vendemos, não alugamos e não cedemos os seus dados para ninguém usar em publicidade.

# Com quem compartilhamos

- **WhatsApp:** o pedido vira uma conversa por lá, então o conteúdo dela passa pelo serviço de mensagens, com as regras de privacidade dele.
- **Entrega:** nome, endereço e telefone vão para quem leva a encomenda até você.
- **Tecnologia:** o site, o banco de dados e as imagens ficam em serviços de hospedagem contratados, que guardam os dados em nosso nome e não podem usá-los para outra finalidade.

# Pagamento

Nenhum pagamento é processado por este site. Não há maquininha, gateway nem cobrança automática aqui: a forma de pagamento que você escolhe é apenas uma informação do pedido, e o acerto acontece depois, com a gente. Por isso nunca pedimos número de cartão, senha de banco ou código de segurança pelo site — se alguém pedir em nome da loja, desconfie e fale com a gente.

# Cookies

Usamos cookies para manter você conectado na sua conta e para o site funcionar. Não usamos cookies de publicidade nem rastreadores de terceiros para seguir você por outros sites.

# Por quanto tempo guardamos

Os dados do pedido ficam enquanto durarem as obrigações legais e fiscais da venda. Os dados da conta ficam enquanto a conta existir.

# Os seus direitos

Pela Lei Geral de Proteção de Dados, você pode pedir a qualquer momento para confirmar quais dados temos, corrigir o que estiver errado, pedir uma cópia, apagar o que não for obrigatório guardar ou retirar o consentimento. É só falar com a gente.

# Como falar com a gente

Use o WhatsApp ou o e-mail que estão no rodapé do site. Respondemos sobre privacidade pelo mesmo canal em que atendemos a venda.

# Mudanças nesta política

Se mudarmos alguma coisa aqui, o texto atualizado passa a valer a partir da publicação nesta página.
`;
