# Fotos dos atalhos da home

As sete fotos dos círculos que abrem a home, logo abaixo do banner. **São fotos
da loja**, enviadas pela dona em 09/11/2026 — e não banco de imagem.

Cada arquivo casa com um atalho pelo nome, e o casamento está escrito em
`backend/scripts/shortcuts/config.ts`:

| Arquivo | Atalho | Leva para |
|---|---|---|
| `ISABELLE LA BELLE.jpg.jpeg` | Isabelle La Belle | a vitrine filtrada pela marca |
| `VITORIA'S SECRETS.jpg.jpeg` | Victoria's Secret | a vitrine filtrada pela marca |
| `MAIS VENDIDOS.jpg.jpeg` | Mais vendidos | `/mais-vendidos` |
| `FEMININO.jpg.jpeg` | Feminino | a categoria `feminino` |
| `MASCULINO.jpg.jpeg` | Masculino | a categoria `masculino` |
| `BODY SPLASH MASCULINO.jpg.jpeg` | Body Splash Masculino | a categoria `body-splash-masculino` |
| `PASTAS ISABELLE LA BELLE.jpg.jpeg` | Hidratantes | a categoria `hidratantes` |

A última linha não é engano: o arquivo descreve o que está na imagem — as
pastas hidratantes — e o rótulo é o que a cliente procura.

## Como subir

Pelo painel, uma por vez: **Ajustes → Atalhos da home → Enviar foto**. É o
caminho normal, e o único que a dona precisa saber.

De uma vez, pelo terminal:

```sh
cd backend
npm run shortcuts:upload -- --dir=../fotos-categorias --dry-run
npm run shortcuts:upload -- --dir=../fotos-categorias
```

O script sobe as fotos para o Cloudinary e monta a fileira inteira nas
configurações. Ver `backend/scripts/shortcuts/README.md` — inclusive a nota
sobre **contra qual banco isso roda**.

## O enquadramento

A home **não recorta** estas artes. O disco dourado que elas trazem é desenhado
na medida exata do círculo, e o que está fora do disco — o frasco mais alto que
ele, a asa do pavão de `FEMININO` — aparece por fora, solto sobre a página.

As sete seguem a mesma régua: **quadrado de 600px, disco centrado com 506px**,
ou 84,3% do lado. É essa proporção que o CSS da fileira usa para fazer o disco
fechar com o contorno, então uma arte nova precisa vir no mesmo enquadramento.

O fundo branco destes JPEGs **é recortado no envio** e a arte sobe como PNG
transparente (`backend/scripts/shortcuts/art.ts`). Pelo painel não há recorte:
ali a dona precisa enviar um PNG já sem fundo, senão fica um quadrado branco em
volta do círculo — invisível na loja clara, e um bloco leitoso no tema escuro.
O painel mostra o círculo no tamanho real, com a sobra para fora, para que isso
se descubra antes de publicar.

## O que havia aqui antes

Sete fotos de banco de imagem (Pexels), uma por categoria cadastrada, usadas
como tapa-buraco nos círculos enquanto a fileira era a árvore de categorias.
Elas saíram quando as fotos de verdade chegaram. A fileira também deixou de ser
a árvore: hoje é uma lista própria, editada em Ajustes → Atalhos da home.

As fotos das **categorias** — que ainda valem, para os cartazes de coleção e
para a fileira de reserva — continuam sendo enviadas em Painel → Categorias →
Editar categoria → Enviar foto, ou por `backend/scripts/categories/`.
