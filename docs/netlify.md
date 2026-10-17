# Publicação na Netlify

O frontend é servido pelo CDN da Netlify, e `/api/*` é encaminhado para a Function `api`. A versão online usa PostgreSQL externo (Supabase ou outro provedor compatível). A instalação local continua usando o SQLite existente, sem qualquer substituição de arquivos em `data/`.

## Configuração

- Repositório: `ei-Gih/FlowLearn`, branch `main`.
- Build: `npm run build`; publicação: `dist`; Functions: `netlify/functions`.
- Node: 24, definido no `netlify.toml`.
- A migration inicial fica em `server/migrations/001_online.sql`. Aplique-a ao banco externo antes de liberar o acesso. As tabelas ficam no schema privado `englishflow`, separado da API pública do Supabase.
- O banco online é um banco novo. As contas e conteúdos locais não são enviados automaticamente para a internet. No primeiro acesso online, crie sua conta.

A equipe pode manter o plano Free Legacy da Netlify; não é necessário ativar Netlify Database. Não publique somente os arquivos de `dist`: login e dados dependem da Function e do banco.

## Variáveis privadas opcionais

Configure somente no painel da Netlify, com escopo de Functions:

- `OPENAI_API_KEY`: habilita análise de transcrições, perguntas e exercícios.
- `AI_MODEL`: modelo usado pelo serviço de IA; padrão `gpt-4.1-mini`.
- `RESET_WEBHOOK_URL`: serviço privado de envio do código de recuperação de senha.

`DATABASE_URL` contém a URI do PostgreSQL externo (pooler recomendado). A senha pode ficar separada em `DATABASE_PASSWORD`; nesse caso a URI pode manter `[YOUR-PASSWORD]`, e o servidor codifica os caracteres especiais corretamente. Marque ambos como segredo no contexto Production. No plano Legacy, se não for possível restringir o escopo a Functions, mantenha os escopos oferecidos pelo painel; o frontend não lê essas variáveis. Se o provedor exigir um certificado raiz próprio, configure `DATABASE_CA`; a verificação de certificados permanece ativa. Nunca adicione a conexão do banco ou chaves a variáveis `VITE_*`, ao código frontend ou ao Git.

## Verificação

`GET /api/health` retorna `{ "ok": true }` quando o banco está acessível. `GET /api/me` sem sessão deve retornar HTTP 401 em JSON. Após cadastro/login, verifique conteúdo salvo, favorito, revisão e biblioteca depois de recarregar a página.

`server/netlify.test.mjs` testa a Function com PostgreSQL embutido: cadastro, login, isolamento, biblioteca, demos, revisão idempotente e continuidade das sessões e do feed entre instâncias. As revisões usam transações na mesma conexão e bloqueio da linha de conteúdo. O limite de tentativas de autenticação fica persistido no banco, além do limite por instância.

O arquivo SQLite local, `.env`, logs e estado de autenticação das ferramentas não são publicados. O banco externo segue os limites do plano contratado no seu provedor. O plano existente da Netlify é preservado.
