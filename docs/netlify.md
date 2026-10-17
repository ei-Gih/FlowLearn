# Publicação na Netlify

O frontend é servido pelo CDN da Netlify, e `/api/*` é encaminhado para a Function `api`. A versão online usa Netlify Database (PostgreSQL). A instalação local continua usando o SQLite existente, sem qualquer substituição de arquivos em `data/`.

## Configuração

- Repositório: `ei-Gih/FlowLearn`, branch `main`.
- Build: `npm run build`; publicação: `dist`; Functions: `netlify/functions`.
- Node: 24, definido no `netlify.toml`.
- As migrations ficam em `netlify/database/migrations`. O SDK `@netlify/database` permite provisionamento e migrations pelo ciclo de deploy da Netlify.
- O banco online é um banco novo. As contas e conteúdos locais não são enviados automaticamente para a internet. No primeiro acesso online, crie sua conta.

Se a equipe não oferecer Netlify Database, é necessário disponibilizar um PostgreSQL compatível ou habilitar o recurso no plano. Não publique somente os arquivos de `dist`: login e dados dependem da Function e do banco.

## Variáveis privadas opcionais

Configure somente no painel da Netlify, com escopo de Functions:

- `OPENAI_API_KEY`: habilita análise de transcrições, perguntas e exercícios.
- `AI_MODEL`: modelo usado pelo serviço de IA; padrão `gpt-4.1-mini`.
- `RESET_WEBHOOK_URL`: serviço privado de envio do código de recuperação de senha.

O SDK obtém a conexão do banco pela configuração do próprio projeto. Nunca adicione a conexão do banco ou chaves a variáveis `VITE_*`, ao código frontend ou ao Git.

## Verificação

`GET /api/health` retorna `{ "ok": true }` quando o banco está acessível. `GET /api/me` sem sessão deve retornar HTTP 401 em JSON. Após cadastro/login, verifique conteúdo salvo, favorito, revisão e biblioteca depois de recarregar a página.

`server/netlify.test.mjs` testa a Function com PostgreSQL embutido: cadastro, login, isolamento, biblioteca, demos, revisão idempotente e continuidade das sessões e do feed entre instâncias. As revisões usam transações na mesma conexão e bloqueio da linha de conteúdo. O limite de tentativas de autenticação fica persistido no banco, além do limite por instância.

O arquivo SQLite local, `.env`, logs e estado de autenticação das ferramentas não são publicados. O Netlify Database consome os recursos/créditos previstos no plano da equipe; mudanças de plano ou habilitação de cobrança automática precisam ser feitas pelo titular.
