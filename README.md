# EnglishFlow

Aplicação pessoal de inglês com React + TypeScript, Vite, API Express e banco relacional SQLite. Requer Node.js 24 ou superior. Não precisa configurar banco externo para usar localmente.

## Executar

```powershell
cd C:\Users\Gisele\OneDrive\Documentos\Github\FlowLearn
npm install
Copy-Item .env.example .env
npm run dev
```

Abra http://127.0.0.1:5173. Crie uma conta e configure seu perfil. Para versão compilada: `npm run build` e `npm start`, depois abra http://127.0.0.1:3001.

## Feed vertical de vídeos

A Home agora tem feed vertical com scroll snap, players de arquivos diretos, embeds oficiais de YouTube/TikTok, controles, explicações e revisão no próprio vídeo. Veja [detalhes, compatibilidade e testes](docs/video-feed.md). A migração de mídia é automática, aditiva e preserva os dados existentes.

## O que funciona

- Cadastro, login, logout, sessão em cookie HttpOnly, senha com scrypt e isolamento por usuário em todas as consultas.
- Biblioteca persistente, links HTTP/HTTPS normalizados, duplicatas por usuário, favoritos, pesquisa, filtros, ordenação, tags e detalhes.
- Revisões com intervalos de 1, 3, 7, 14, 30, 60 e 120 dias; esquecimento reinicia o intervalo, lembrança parcial reduz um passo.
- Feed ordenado por atraso, dificuldade e desempenho; progresso real, sequência diária no fuso de São Paulo, meta e gráficos.
- Demonstração optativa, identificada e excluída das estatísticas.
- Tema claro/escuro, interface responsiva, navegação mobile, manifest PWA e página offline. Registro de revisões requer conexão.
- Análise, professor contextual e exercícios com correção no backend quando a IA está configurada.

## Integrações e limites

Defina `OPENAI_API_KEY` somente no `.env` do servidor. A aplicação não busca nem baixa vídeos. A análise usa a transcrição fornecida pelo usuário, e informa indisponibilidade quando não existe chave. Links do YouTube com ID válido têm player; demais conteúdos abrem na plataforma original. O acesso externo pode ser restringido pelo provedor.

Para recuperação de senha, configure `RESET_WEBHOOK_URL` com um serviço privado de entrega de e-mail. Ele recebe `{ email, token }`; envie ao usuário o código para o formulário de recuperação. Códigos expiram em uma hora, e a troca revoga as sessões. Sem esse serviço, a interface informa que a recuperação não está configurada.

O banco fica em `data/englishflow.sqlite`. Faça backup com o servidor parado; nunca versione banco ou `.env`. A API escuta apenas em loopback por padrão. Para produção é necessário HTTPS, proxy, política de backups, entrega de e-mail, observabilidade e revisão operacional. Use `NODE_ENV=production` atrás de HTTPS para cookies seguros. PWA no celular requer hospedagem HTTPS; localhost funciona para desenvolvimento.

## Estrutura

`src/components`: interface reutilizável; `src/services`: cliente HTTP; `src/types.ts`: tipos; `server/index.mjs`: API e persistência; `server/scheduler.mjs`: estratégia substituível de revisão; `server/ai.mjs`: serviço central de IA; `public`: PWA.

SQLite foi escolhido para funcionamento local imediato. A camada de consultas pode ser migrada para PostgreSQL. Esta primeira versão não inclui push, extração automática de metadados/transcrição, upload de foto, algoritmos probabilísticos de feed, exercícios de áudio nem sincronização offline. Recomendações locais são calculadas pelo histórico; o serviço de IA também expõe uma função para evolução das recomendações.

## Verificar

```powershell
npm test
npm run build
```

Os testes do agendador verificam progressão, esquecimento e prioridade de atrasados. As chaves da IA e o serviço de e-mail precisam ser fornecidos para validar essas integrações.
