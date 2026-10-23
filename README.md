# Passe

Sistema de gestão de jogadores, clubes, transferências e partidas de uma liga de futebol.

## Pré-requisitos

- Ubuntu 24.04 LTS.
- Git 2.x.
- Docker Engine 24+ e plugin Docker Compose 2.20+, disponíveis sem `sudo`.
- Portas 3000, 5173 e 5432 livres e acesso à internet.

Node.js 20, npm 10 e PostgreSQL 16.15 rodam nos contêineres. O build instala as dependências com `npm ci`, usando os `package-lock.json` versionados.

## Instalação e execução

Clone o projeto:

```bash
git clone https://github.com/danielhrds/desafio-isi-dev-1.git
cd desafio-isi-dev-1
```

Na raiz do repositório, inicie os três serviços:

```bash
docker compose up --build -d --wait
```

Todos os comandos a seguir também rodam na raiz, com os serviços iniciados.

- Frontend: http://localhost:5173
- Origem da API: http://localhost:3000 — endpoints em `/api/v1`.
- Swagger: http://localhost:3000/api-docs/
- Healthcheck: http://localhost:3000/api/v1/health

Para consultar os serviços e os logs:

```bash
docker compose ps
docker compose logs --tail=50 backend
```

O Morgan registra data/hora, método, caminho e status de cada requisição.

Para parar os serviços sem apagar o banco, opcionalmente execute:

```bash
docker compose down
```

## Criação e recriação do banco

Na primeira subida, o banco `passe` é criado vazio e o backend aplica as migrations de `backend/src/database/migrations/`. Não há seed automático. Os dados persistem no volume `postgres_data` entre reinicializações.

Para recriar o banco do zero, execute na raiz:

```bash
docker compose down --volumes
docker compose up --build -d --wait
```

**Isso apaga os dados do banco e os volumes de dependências deste projeto Compose.** A subida seguinte recria o banco vazio e reaplica as migrations.

## Variáveis de ambiente

O [compose.yaml](compose.yaml) já fornece os valores abaixo. Não é necessário copiar os arquivos [backend/.env.example](backend/.env.example) e [frontend/.env.example](frontend/.env.example) para executar pelo Docker.

### Backend

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://passe:passe_dev@db:5432/passe
FRONTEND_ORIGIN=http://localhost:5173
TZ=America/Sao_Paulo
```

`FRONTEND_ORIGIN` define a origem permitida pelo CORS. O `.env.example` usa `localhost` para o banco; no Compose, a conexão usa o serviço `db`.

### Frontend

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
```

Essa é a base da API usada pelo navegador.

### PostgreSQL e observação de arquivos

```dotenv
POSTGRES_DB=passe
POSTGRES_USER=passe
POSTGRES_PASSWORD=passe_dev
TZ=America/Sao_Paulo
```

São credenciais locais de desenvolvimento. Backend e frontend também recebem `CHOKIDAR_USEPOLLING=true` para observação de arquivos por polling.

## Testes

Os comandos terminam sem modo watch.

### Backend

```bash
docker compose exec -T backend npm run test
```

Vitest e Supertest cobrem cálculos, incluindo valor de mercado, endpoints e persistência. Os testes de integração usam bancos temporários `passe_test_*`, removidos ao terminar, sem alterar o banco da aplicação.

### Frontend: componentes e serviços

```bash
docker compose exec -T frontend npm run test
```

Vitest e Testing Library verificam componentes, hooks e serviços, com API simulada.

### Frontend: navegador

Execute em Bash, com o frontend iniciado. O Playwright usa Chromium na imagem oficial e inclui cenários em 375 px:

```bash
docker run --rm --init --ipc=host \
  --network "container:$(docker compose ps -q frontend)" \
  --volumes-from "$(docker compose ps -q frontend)" \
  --workdir /app \
  mcr.microsoft.com/playwright:v1.64.0-noble \
  npm run test:e2e -- --workers=2
```

Esses testes usam API simulada; não são uma integração com backend e banco reais. Os traces de falhas ficam em `frontend/test-results/`.

## Lint, formatação, tipos e build

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm run format:check
docker compose exec -T backend npm run typecheck
docker compose exec -T backend npm run build
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run format:check
docker compose exec -T frontend npm run typecheck
docker compose exec -T frontend npm run build
```

`format:check` verifica a formatação sem alterar arquivos.

## Estrutura de pastas

```text
backend/
  src/                Rotas, validação, serviços, repositories, modelos e OpenAPI
  src/database/       Conexão e migrations
  tests/              Testes unitários e de integração
frontend/
  src/pages/          Páginas
  src/components/     Componentes de domínio, layout e UI
  src/hooks/          Consultas, mutations e estado compartilhado
  src/services/       Cliente HTTP e acesso à API
  tests/e2e/          Cenários Playwright
compose.yaml          Serviços Docker
```

## Bibliotecas utilizadas

As versões exatas das dependências estão nos arquivos `package-lock.json` de cada aplicação.

### Backend

- **Express e cors:** API HTTP e configuração de CORS.
- **Sequelize, pg, pg-hstore e sequelize-cli:** ORM, suporte ao PostgreSQL e migrations.
- **Zod:** validação de entradas.
- **decimal.js:** precisão e arredondamento monetário.
- **Luxon:** datas e fuso de Brasília.
- **Morgan:** logs das requisições.
- **dotenv:** leitura de `.env`.
- **swagger-ui-express:** documentação interativa da API.

### Frontend

- **React 18 e React DOM:** renderização da interface.
- **Vite e @vitejs/plugin-react:** servidor de desenvolvimento e build.
- **React Router DOM:** navegação em modo biblioteca.
- **Tailwind CSS e @tailwindcss/vite:** estilos e responsividade.
- **shadcn/ui e @radix-ui/react-\*:** componentes UI e suas primitivas acessíveis. Os componentes shadcn ficam em `src/components/ui/`.
- **React Hook Form, Zod e @hookform/resolvers:** formulários e validação.
- **Axios:** requisições HTTP.
- **TanStack Query:** cache, consultas, mutations e invalidação de dados.
- **Lucide React e Sonner:** ícones e notificações, respectivamente.
- **class-variance-authority, clsx e tailwind-merge:** variantes e composição de classes dos componentes.

### Desenvolvimento e testes

- **TypeScript e @types/\*:** tipagem do código e das bibliotecas.
- **tsx:** execução do backend TypeScript com observação de arquivos.
- **Vitest e Supertest:** testes e requisições à aplicação Express.
- **Testing Library, user-event, jest-dom e jsdom:** renderização, interações, asserções e ambiente DOM nos testes de componentes.
- **Playwright:** testes no navegador.
- **ESLint, @eslint/js, typescript-eslint e globals:** análise estática e configuração de regras.
- **eslint-plugin-react-hooks e eslint-plugin-react-refresh:** regras de hooks e Fast Refresh.
- **Prettier:** formatação.

## Funcionalidades não implementadas

Nenhuma.
