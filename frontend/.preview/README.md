# Bancada de revisao visual (temporaria)

Nada aqui entra no build. Existe para abrir a loja sem backend e sem MongoDB e
conferir o visual em desktop e celular. **Apagar esta pasta, junto de
`frontend/dev-preview.html`, `frontend/src/dev-preview.tsx` e
`frontend/.env.preview`, antes de levar a `developer` para a `main`.**

## Subir a loja com dados de exemplo

```sh
cd frontend
npx vite --mode preview --port 5199 --strictPort
```

Abre em `http://localhost:5199/dev-preview.html`. A entrada intercepta o
`fetch` e responde as rotas da API com dados fabricados (`src/dev-preview.tsx`);
as fotos vem da nuvem publica `demo` do Cloudinary, definida em `.env.preview`.

Outra rota vai no fragmento, porque o Vite nao tem fallback de historico para
esta pagina:

```
http://localhost:5199/dev-preview.html#/produtos/oud-royale-intense
```

## Capturar as telas

```sh
node .preview/cdp.mjs <etiqueta>
```

Sobe o Chrome com a porta de depuracao, emula desktop (1440) e celular (390,
com toque e DPR 2), e salva em `<scratchpad>/shots/<etiqueta>/` uma fatia de
1400px por vez — a pagina inteira num PNG so fica pequena demais para julgar
espacamento. Grava tambem um `report.json` com largura de rolagem, overflow
horizontal e alvos de toque menores que 40px.

Nao ha caminho de maquina escrito nos scripts: `env.mjs` resolve os tres que
eles precisam. A pasta de saida sai de `PREVIEW_DIR`, ou do diretorio temporario
do sistema; o navegador e o primeiro Chromium encontrado — Chrome, senao Edge,
que existe em toda maquina Windows —, ou o que `PREVIEW_BROWSER` apontar; e o
`node_modules` do `ws` vem da propria posicao de `.preview/`.

```sh
PREVIEW_DIR=/caminho/para/as/capturas node .preview/cdp.mjs <etiqueta>
```

## Ver o rodape do celular aberto

```sh
node .preview/open-footer.mjs
```

As quatro colunas do rodape nascem fechadas no celular, entao a captura comum
so mostra a fileira recolhida. Este script abre as quatro e grava
`<saida>/shots/rodape-aberto.png`.

## Medir uma pagina

```sh
MSYS_NO_PATHCONV=1 node .preview/probe.mjs "/" "<expressao JS>" [largura]
```

`MSYS_NO_PATHCONV=1` nao e opcional no Git Bash: sem ele a rota `/` vira
`C:/Program Files/Git/` e a pagina abre em 404.

## Auditar contraste

```sh
MSYS_NO_PATHCONV=1 node .preview/probe.mjs "/" "$(cat .preview/contrast-expr.js)"
```

Percorre todo no de texto, resolve a cor de fundo subindo a arvore, calcula o
contraste e lista o que reprova (4.5:1 para texto normal, 3:1 para texto
grande). Ignora o que esta desabilitado e o que esta marcado `aria-hidden`.

Texto sobre foto sai como falso positivo — o calculo nao enxerga atraves do
degrade do veu. Na home sao os dois rotulos dos cartazes de categoria, e os
dois estao corretos por construcao.
