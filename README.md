# Maison Essence

Loja de perfumes e velas aromaticas: uma API em NestJS e, em breve, a loja em
React. Os dois vivem neste repositorio, mas sao projetos independentes — nao ha
workspaces, nao ha `package.json` na raiz, e cada pasta tem as proprias
dependencias e o proprio deploy.

```
maison-essence/
├── backend/    API NestJS (MongoDB, funcao serverless na Vercel)
├── frontend/   loja em React (Vite, site estatico)
├── docs/       plano de prompts e material de apoio
├── .gitignore
└── README.md
```

## Rodando

Cada pasta se instala e roda por conta propria. Nao existe comando na raiz: o
primeiro passo e sempre entrar na pasta do projeto.

```bash
cd backend
cp .env.example .env    # preencha MONGODB_URI e os segredos
npm install
npm run start:dev       # http://localhost:3000/api/v1
```

Os demais comandos do backend — build, testes, lint e os seeds que criam o
primeiro super-admin e a loja de demonstracao — estao em
[backend/README.md](backend/README.md).

A loja roda do mesmo jeito, na porta 5173:

```bash
cd frontend
cp .env.example .env    # preencha VITE_API_URL e VITE_CLOUDINARY_CLOUD_NAME
npm install
npm run dev             # http://localhost:5173
```

A estrutura, as variaveis de ambiente e as decisoes que valem para a loja
inteira estao em [frontend/README.md](frontend/README.md).

## Deploy

Sao **dois projetos separados na Vercel**, apontando para o mesmo repositorio e
se distinguindo pelo *Root Directory*:

| Projeto  | Root Directory | O que publica                          |
| -------- | -------------- | -------------------------------------- |
| API      | `backend`      | a funcao serverless de `backend/api/`  |
| Loja     | `frontend`     | o site estatico                        |

Com o *Root Directory* apontado para a pasta, a Vercel instala, constroi e le o
`vercel.json` de dentro dela — e cada projeto tem as proprias variaveis de
ambiente. Um push que so toca `backend/` reconstroi so a API.
