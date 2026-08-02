# CLAUDE.md

Memória de trabalho do projeto App de Escala. Leia este arquivo primeiro para pegar o contexto rápido; os detalhes completos ficam em `memoria/memoria.md`.

## Estado atual (2026-08-01)

- Fases 0 a 4 implementadas e publicadas em https://github.com/devsecfate/App-de-escala (branch `main`). Detalhes em `memoria/memoria.md`.
- Fase 4 entregou o repertório de louvor: tela `/ministerios/:id/repertorio` (músicas, categorias e **colunas configuráveis** pelo líder, gravadas em `musicas.extras` com as definições na nova tabela `campos_musica`), cronograma do culto dentro de Montar escala (só aparece para ministério que tem repertório) e o repertório entrando no texto compartilhado no WhatsApp. Tirar música de uso é `ativa=false`, não delete, como `repertorio/louvores.md` pede.
- Próximo passo: **Fase 5** — instalação como PWA, leitura offline e relatório de quantas vezes cada pessoa serviu no período.
- Fase 2 entregou: tela "Minha disponibilidade" (`/disponibilidade`), confirmar/recusar presença em "Minhas escalas", painel do líder com status de confirmação em "Montar escala", regras do ministério configuráveis (`MinisterioDetalhe`), e `validarEscalacao` chamado de verdade antes de salvar uma escalação (bloqueios impedem, avisos só informam).
- Fase 3 entregou: compartilhar a escala no WhatsApp (`texto-escala.ts` + botão em Montar escala, registrando na tabela `envios`); push do PWA (service worker próprio em `apps/web/src/sw.ts` via `injectManifest`, tabela `push_subscriptions`, botão "Avisos no celular" na Home); e lembrete de véspera (Edge Function `enviar-lembretes`, com a conta de "amanhã" por fuso da igreja em `packages/core/src/lembretes.ts`).
- **O projeto já roda contra Postgres real.** `npx supabase start` (com Docker Desktop aberto) aplica as 5 migrations e o seed; `npm run test:integracao` roda 19 testes contra esse banco, incluindo o isolamento entre ministérios que o planejamento chama de teste mais importante. `npm test` continua puro e não precisa de Docker.
- Subir o banco revelou dois bugs que travavam o app inteiro e que só apareceriam em produção — ver `memoria/memoria.md`: (1) o seed criava usuários com colunas de token `null`, e o GoTrue derrubava **todo login**; (2) faltavam os GRANTs de tabela para `authenticated`/`service_role`, então toda query respondia "permission denied" mesmo com RLS correta. Ambos corrigidos.
- A Edge Function `enviar-lembretes` já foi exercitada de verdade com `supabase functions serve`: achou a escalação do dia seguinte (filtro por fuso funcionando — o evento a 10 dias ficou de fora), buscou os aparelhos e chamou o `web-push` com chaves VAPID reais, falhando só na criptografia porque as chaves do aparelho eram falsas.
- **O que ainda não foi verificado:** entrega real de push num aparelho (precisa de inscrição de navegador de verdade) e o agendamento diário — o `cron.schedule` está em comentário no fim de `enviar-lembretes/index.ts`, não numa migration, porque depende do project-ref que ainda não existe.
- Antes de usar push é preciso gerar o par VAPID (comando no `.env.example` e no fim de `enviar-lembretes/index.ts`): a pública vai em `VITE_VAPID_PUBLIC_KEY`, a privada vira segredo da Edge Function. Sem a chave, o botão "Avisos no celular" simplesmente não aparece.
- **Cuidado com o build:** `apps/web/src/lib/supabase.ts` faz `throw` no topo do módulo. Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, o Vite inlineia as variáveis vazias, o `throw` vira incondicional e o Rollup descarta o app inteiro — o build saía com código 0 e um bundle de 182 KB só com bibliotecas. Corrigido em `vite.config.ts`, que agora aborta o build com mensagem clara. Para buildar local: copie `apps/web/.env.example` para `apps/web/.env`. Bundle saudável tem ~432 KB.
- Docker Desktop está instalado mas não sobe sozinho: abra o app antes de `npx supabase start`. Depois de mexer em migration ou no seed, use `npx supabase db reset` e rode a suíte de integração de novo.
- O `apps/web` agora tem três tsconfigs: `tsconfig.app.json` (DOM, exclui `src/sw.ts`), `tsconfig.node.json` (vite.config) e `tsconfig.worker.json` (WebWorker, só o service worker). `tsc -b` cobre os três.
- Deploy (Vercel / Supabase cloud) ainda não foi feito, depende do usuário logar nessas contas.

## Como trabalhar neste projeto

- Perguntar antes de fazer commit/push, mesmo que já tenha sido autorizado antes — cada vez é uma autorização nova.
- Perguntar antes de criar recursos em contas externas (Supabase cloud, Vercel).
- Seguir os documentos em `planejamento/` como fonte de verdade de produto/arquitetura.

## O que é o app

App para organizar a escala de pessoas que servem na igreja, separadas por ministério, deixando o processo mais simples e organizado.

## Decisões importantes

- Cada pessoa pertence a um ou mais ministérios e só pode ser escalada no ministério ao qual pertence.
- Os líderes de cada ministério montam e editam a escala do próprio ministério direto pelo app, sem depender de um administrador central.
- Plataforma: web responsivo / PWA primeiro; app nativo (Play Store/App Store) é objetivo futuro.
- Stack definida: React + TypeScript + Vite + Tailwind no front, Supabase (Postgres + Auth + Row Level Security) no back. Detalhes completos em `planejamento/arquitetura.md`.
- Escopo do produto e roadmap por fases: `planejamento/planejamento.md`.

## Estrutura do repositório

- `memoria/` memória detalhada do projeto (contexto, decisões, histórico)
- `planejamento/` planejamento de produto e arquitetura técnica
- `regras/` regras de negócio da escala
- `ferramentas/` ferramentas e integrações usadas pelo app
- `ministerios/` cadastro de ministérios e líderes
- `pessoas/` cadastro de pessoas por ministério
- `escalas/` escalas geradas, por período
- `repertorio/` biblioteca de louvores predefinidos para montar o cronograma do ministério de louvor

## Pendências

Ver seção "Estado atual" no topo deste arquivo.
