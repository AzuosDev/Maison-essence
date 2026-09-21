# Maison Essence — loja

A loja em React. Consome a API de [`../backend`](../backend) e nao fala com
mais nada: nao ha banco, nao ha servidor proprio, nao ha rota de API aqui. O
build e um site estatico.

## Rodando

```bash
cd frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

Sem `.env`, o desenvolvimento assume `http://localhost:3000/api/v1` — a API que
`npm run start:dev` do backend sobe — e desenha o placeholder no lugar das
imagens. No build de producao as duas variaveis sao obrigatorias e a aplicacao
recusa subir sem elas, dizendo qual falta.

| Variavel | Para que |
| --- | --- |
| `VITE_API_URL` | URL da API, com o prefixo `/api/v1` e sem barra no fim |
| `VITE_CLOUDINARY_CLOUD_NAME` | Conta do Cloudinary, para montar a URL das fotos |

Nada com o prefixo `VITE_` e segredo: vai no bundle, em texto puro, visivel
para qualquer visitante. A API key e a secret do Cloudinary ficam no backend.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de producao em `dist/` |
| `npm run preview` | Serve o `dist/` como a Vercel serviria |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b`, sem emitir |
| `npm test` | Vitest |

## Estrutura

```
src/
├── app/          router, providers, layouts e boundaries de erro
├── pages/        uma pasta por rota
├── components/
│   ├── ui/       primitivos do design system (nao conhecem a loja)
│   ├── store/    componentes da loja
│   └── admin/    componentes do painel
├── features/     cart, checkout, auth, catalog
├── lib/          cliente HTTP, formatadores, Cloudinary, env
└── styles/       tokens, reset, tipografia
```

A regra de dependencia: `lib` nao importa nada; `features` importa `lib`;
`components` importa `lib` e `features`; `pages` e `app` importam tudo. Import
no sentido contrario e sinal de que algo esta na pasta errada.

## Decisoes que valem para tudo

**Um cliente HTTP.** Nenhum `fetch` solto: tudo passa por `lib/http`. Ele
anexa o access token, e num `401` renova a sessao uma vez e refaz a
requisicao. Chamadas simultaneas que tomam `401` compartilham uma renovacao so
— o backend rotaciona o refresh token a cada uso e trata reuso como sinal de
roubo, entao dois refreshes em paralelo derrubariam a sessao. O teste em
`lib/http/client.spec.ts` existe por causa disso.

**Duas sessoes, nao uma.** Painel e loja tem tokens, cookies e rotas de
renovacao diferentes, e convivem no mesmo navegador — a dona compra na propria
loja. Cada uma tem o seu store (`features/auth`) e a sua chave no
`localStorage`.

**Dinheiro em centavos, sempre.** O valor viaja e e calculado como inteiro;
quem desenha chama `formatCents`. Nenhum componente divide por cem nem escreve
`R$` na mao. Os formatadores estao em `lib/format` — moeda, telefone e data.

**A sacola e do cliente, o total e do servidor.** O carrinho vive no navegador
(`features/cart`, persistido). O preco guardado nele serve para o resumo
lateral e nada mais: quem diz quanto custa e `POST /cart/quote`.

**Imagem pelo `publicId`.** O backend guarda o identificador do Cloudinary, e
as duas pontas montam a URL com a mesma regra (`lib/cloudinary`), nos presets
`thumb`, `card` e `detail`. Divergir ai custa o cache do CDN.

**Tokens de estilo, nao valores soltos.** Cor, fonte, espaco, raio e sombra
saem de `styles/tokens.css`. O resto e CSS Module com escopo no componente.

**Um boundary de erro por rota.** Um erro na pagina do produto troca o miolo e
deixa cabecalho, rodape e sacola de pe, em vez de apagar a loja.

## Deploy

Projeto proprio na Vercel, com *Root Directory* apontado para `frontend`. O
`vercel.json` daqui faz o rewrite de toda rota para o `index.html` — sem ele,
abrir `/painel` direto no navegador daria 404 — e marca os arquivos com hash
como imutaveis.
