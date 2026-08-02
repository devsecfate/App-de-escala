# CLAUDE.md

Memória de trabalho do projeto App de Escala. Leia este arquivo primeiro para pegar o contexto rápido; os detalhes completos ficam em `memoria/memoria.md`.

## Estado atual (2026-08-01)

- Fases 0 a 4 implementadas e publicadas em https://github.com/devsecfate/App-de-escala (branch `main`). Detalhes em `memoria/memoria.md`.
- Fase 4 entregou o repertório de louvor: tela `/ministerios/:id/repertorio` (músicas, categorias e **colunas configuráveis** pelo líder, gravadas em `musicas.extras` com as definições na nova tabela `campos_musica`), cronograma do culto dentro de Montar escala (só aparece para ministério que tem repertório) e o repertório entrando no texto compartilhado no WhatsApp. Tirar música de uso é `ativa=false`, não delete, como `repertorio/louvores.md` pede.
- Próximo passo: **Fase 5** — instalação como PWA, leitura offline e relatório de quantas vezes cada pessoa serviu no período.
- Fase 2 entregou: tela "Minha disponibilidade" (`/disponibilidade`), confirmar/recusar presença em "Minhas escalas", painel do líder com status de confirmação em "Montar escala", regras do ministério configuráveis (`MinisterioDetalhe`), e `validarEscalacao` chamado de verdade antes de salvar uma escalação (bloqueios impedem, avisos só informam).
- Fase 3 entregou: compartilhar a escala no WhatsApp (`texto-escala.ts` + botão em Montar escala, registrando na tabela `envios`); push do PWA (service worker próprio em `apps/web/src/sw.ts` via `injectManifest`, tabela `push_subscriptions`, botão "Avisos no celular" na Home); e lembrete de véspera (Edge Function `enviar-lembretes`, com a conta de "amanhã" por fuso da igreja em `packages/core/src/lembretes.ts`).
- A Fase 4 também não foi testada contra banco real: as migrations `campos_musica` e `push_subscriptions` nunca foram aplicadas, e as queries de músicas/cronograma nunca rodaram no Postgres. Foi validada por 44 testes, `tsc -b` e build.
- **O que da Fase 3 ainda não foi verificado de verdade** (sem Docker/Postgres e sem deploy): a migration `push_subscriptions` nunca foi aplicada; a query com filtro aninhado do PostgREST em `enviar-lembretes` nunca rodou contra o banco; nenhum push chegou a um aparelho de verdade; e o agendamento (`cron.schedule`) está documentado em comentário no fim de `enviar-lembretes/index.ts`, não numa migration, porque depende do project-ref que ainda não existe.
- Antes de usar push é preciso gerar o par VAPID (comando no `.env.example` e no fim de `enviar-lembretes/index.ts`): a pública vai em `VITE_VAPID_PUBLIC_KEY`, a privada vira segredo da Edge Function. Sem a chave, o botão "Avisos no celular" simplesmente não aparece.
- **Cuidado com o build:** `apps/web/src/lib/supabase.ts` faz `throw` no topo do módulo. Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, o Vite inlineia as variáveis vazias, o `throw` vira incondicional e o Rollup descarta o app inteiro — o build saía com código 0 e um bundle de 182 KB só com bibliotecas. Corrigido em `vite.config.ts`, que agora aborta o build com mensagem clara. Para buildar local: copie `apps/web/.env.example` para `apps/web/.env`. Bundle saudável tem ~432 KB.
- Pendência técnica: nunca foi testado ponta a ponta contra Postgres real — Docker Desktop está instalado mas não roda por padrão (precisa `npx supabase start` com o Docker aberto). As Fases 2 e 3 foram validadas por `npm test`, pelo build e (na Edge Function) por `deno check` + execução local do handler, nunca contra o banco real.
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
