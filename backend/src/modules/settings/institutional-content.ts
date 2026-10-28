/**
 * O texto que a loja já nasce dizendo.
 *
 * Quem somos, modo de uso, trocas e devoluções e perguntas frequentes são
 * textos que a dona escreveu uma vez e que não dependem de banco nenhum para
 * existir: são a política da loja e a sua apresentação. Ficam aqui, em
 * Markdown, e entram como conteúdo padrão das páginas institucionais (ver
 * `DEFAULT_INSTITUTIONAL_PAGES`).
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
