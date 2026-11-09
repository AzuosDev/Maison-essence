# Artes dos cartazes de coleção

As duas artes largas do meio da home — a faixa entre as prateleiras. **São
artes da loja**, enviadas pela dona em 09/11/2026, e não banco de imagem.

Cada arquivo casa com um cartaz pelo nome, e o casamento está escrito em
`backend/scripts/posters/config.ts`:

| Arquivo | Cartaz | Leva para |
|---|---|---|
| `VITORIA'S SECRETS.jpg` | Victoria's Secret | a vitrine filtrada pela marca |
| `MAIS VENDIDOS.jpg` | Mais vendidos | `/mais-vendidos` |

Os dois destinos são os mesmos de dois círculos da fileira de atalhos, e ainda
assim são listas separadas: o cartaz é o destaque do meio da página e o círculo
é a navegação da primeira tela, e a dona pode querer mudar um sem mexer no
outro. As fotos dos círculos vivem em `fotos-categorias/`.

## A medida

**1920 × 1080 px, exatamente 16:9.** As duas estão nessa medida, e não é
sugestão:

- a moldura da home tem `aspect-ratio: 16 / 9` fixo e `object-fit: cover`, ou
  seja, **qualquer outra proporção é cortada pelo centro** — uma arte quadrada
  perderia 44% da altura;
- a entrega do Cloudinary vai até `w_1920`, que é a variante que um monitor
  retina grande pede. Abaixo de 1200px de largura a arte chega mole nessas
  telas, porque `c_limit` reduz e nunca amplia.

O `posters:upload` confere as duas coisas e avisa com a medida encontrada
quando uma arte foge — avisa, e não corta: recortar pelo centro calado é
exatamente o que ninguém quer.

### Onde não pôr nada importante

O pé do cartaz recebe um véu escuro e, sobre ele, o nome e o "VER A COLEÇÃO",
alinhados à **esquerda**:

- **os 40% de baixo** ficam sob o véu — no celular isso chega perto de metade
  da altura;
- o canto **inferior esquerdo** é onde o texto cai.

Produto no terço superior e à direita, então. As duas artes atuais resolvem
isso por outro caminho: o produto fica num disco branco centrado sobre fundo
dourado chapado, e o texto cai no dourado liso da esquerda.

## Como subir

Pelo painel, uma por vez: **Ajustes → Cartazes de coleção**. _(A seção ainda
não existe na tela — enquanto isso, o terminal é o caminho.)_

De uma vez, pelo terminal:

```sh
cd backend
npm run posters:upload -- --dir=../fotos-colecao --dry-run
npm run posters:upload -- --dir=../fotos-colecao
```

O script sobe as artes para o Cloudinary e monta a faixa inteira nas
configurações. Ver `backend/scripts/posters/README.md` — inclusive a nota sobre
**contra qual banco isso roda**.

## O que havia aqui antes

Nada: esta pasta nasceu com estas duas artes. O que havia era a faixa saindo do
catálogo — as duas categorias-raiz com mais produtos que tivessem foto, que até
09/11/2026 eram "Body Splash" (41 produtos) e "Perfumes" (38). Ninguém escolhia
aquilo; o catálogo escolhia, e a faixa trocava sozinha quando ele crescia.

Essa dedução **continua existindo como reserva**: sem nenhum cartaz cadastrado,
a home volta a desenhá-la. É o que garante que nenhuma loja fica sem a faixa
por causa de uma lista que ninguém preencheu.
