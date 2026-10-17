# Feed vertical de vídeos

A alteração se limita à área “Seu feed” da Home e ao suporte de mídia necessário para ela. Sidebar, cabeçalho, estatísticas, painel direito, autenticação e páginas existentes foram preservados. O formulário de conteúdo ganhou apenas o campo opcional de URL direta de vídeo.

## Uso

Role dentro do vídeo, deslize no celular ou use as setas laterais. Com o feed focado, ↑/↓ navegam e espaço alterna reprodução. Toque no vídeo próprio para pausar/reproduzir. Cada item mostra fonte, nível, categoria, revisões, favorito, link original e “Ver explicação”.

O item visível reproduz sem áudio. O anterior pausa; os players externos são desmontados ao sair do item, e arquivos diretos são carregados apenas para o item atual e seus vizinhos. Abrir a explicação, abrir detalhes, tirar o feed da tela ou ocultar a aba suspende a reprodução.

As respostas de revisão são liberadas após assistir a aproximadamente 70% do vídeo ou 8 segundos (o que vier primeiro). Para fallback, o usuário pode confirmar que já assistiu na plataforma original. Revisões são persistidas pela API existente, com chave de idempotência para evitar duplicação em uma repetição de requisição. O histórico, intervalo, contador e prioridade são atualizados.

A sessão preserva sua ordem enquanto as prioridades mudam, inclusive na paginação. Uma nova sessão ou o botão atualizar recalcula a prioridade. O fim das revisões mostra o total revisado e a distribuição entre lembrados, parciais e esquecidos.

## Mídia

- Arquivo direto MP4/WebM: HTML5 Video. Pode ser informado no link principal ou no campo opcional `video_url`, separado de `source_url`.
- YouTube: IFrame Player API oficial, incluindo links watch, shorts e youtu.be. Autoplay depende da política do navegador.
- TikTok: Embed Player oficial quando há ID de vídeo no link (`/@criador/video/ID`). Links curtos sem ID usam fallback; não há resolução ou download oculto.
- Instagram e fontes genéricas: fallback explícito com acesso ao conteúdo original. A aplicação não tenta tratar um link social como um arquivo de vídeo.
- Texto: renderizador de leitura separado, sem afirmar que existe vídeo.

Se um player falhar, bloquear autoplay ou demorar a responder, há indicação explícita e acesso à fonte. O botão play/pause acompanha eventos reais do player. O YouTube conserva seus controles nativos e a identificação da plataforma.

Os cinco clipes didáticos em `public/demo/` foram produzidos localmente, são silenciosos e estão identificados como DEMONSTRAÇÃO. Não são gravações de pessoas nem vídeos extraídos das plataformas. Contas vazias podem adicioná-los pelo botão de demonstração. Registros demonstrativos antigos recebem os novos arquivos sem perder revisões. Eles continuam excluídos das estatísticas reais.

## API e dados

`GET /api/feed?limit=12&offset=0&seed=<identificador-da-sessão>` exige a sessão atual. Retorna `items`, `total`, `due_count`, `has_more`, `next_offset` e `seed`. O limite máximo é 30. Datas de hoje usam America/Sao_Paulo.

`server/feed.mjs` contém `getFeedContents`, `getSmartFeed`, a identificação de fonte e a migração aditiva repetível. Ela adiciona somente `video_url`, `thumbnail_url`, `description`, `platform`, `content_type` e `reviews.request_key`, mais índices. `url`, `transcript`, `next_review`, `last_review` e `reviews` continuam sendo os campos existentes; a resposta inclui aliases de compatibilidade, como `source_url`, `transcription`, `translation` e `review_count`.

Prioridade por grupo: atrasados, previstos hoje, baixo desempenho, novos, outros conteúdos e dominados. Uma variação pequena e determinística por sessão evita uma sequência sempre idêntica sem misturar grupos de prioridade. A ordem de IDs fica em memória por até uma hora; após reinício do servidor, uma nova sessão pode ter outra ordem.

Não há migração destrutiva, troca do banco ou alteração do sistema de autenticação. Novos registros entram no feed ao retornar à Home; o botão atualizar também busca alterações.

## Validação

`npm test` cobre migração repetida preservando conteúdo e sessão, identificação de fontes, prioridades, paginação estável durante revisão, isolamento por usuário, idempotência, favoritos e entrega parcial de MP4 (HTTP 206). O teste de integração inicia servidor e banco temporários.

`npm run build` verifica TypeScript e gera a versão de produção. A verificação visual utiliza clipes locais para não depender de contas, anúncios ou disponibilidade de provedores. Embeds externos continuam sujeitos às restrições da plataforma, rede, privacidade e navegador.
