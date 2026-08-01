# CLAUDE.md

Memória de trabalho do projeto App de Escala. Leia este arquivo primeiro para pegar o contexto rápido; os detalhes completos ficam em `memoria/memoria.md`.

## Estado atual (2026-08-01)

- Fase 0 (fundação técnica), Fase 1 (MVP da escala) e Fase 2 (disponibilidade e confirmação) implementadas. Fases 0 e 1 já publicadas em https://github.com/devsecfate/App-de-escala (branch `main`); Fase 2 ainda não commitada. Detalhes em `memoria/memoria.md`.
- Fase 2 entregou: tela "Minha disponibilidade" (`/disponibilidade`), confirmar/recusar presença em "Minhas escalas", painel do líder com status de confirmação em "Montar escala", regras do ministério configuráveis (`MinisterioDetalhe`), e `validarEscalacao` agora é chamado de verdade antes de salvar uma escalação (bloqueios impedem, avisos só informam). Não precisou de migration nova — `indisponibilidades`, `escalacoes.confirmacao` e `regras_ministerio` já existiam desde a Fase 0.
- Próximo passo: **Fase 3** — texto pronto + WhatsApp, push do PWA, lembrete de véspera.
- Pendência técnica: nunca foi testado ponta a ponta contra Postgres real — Docker Desktop está instalado mas não roda por padrão (precisa `npx supabase start` com o Docker aberto). A Fase 2 só foi validada por `npm test` (motor de regras) e `npm run build` (typecheck), não contra o banco real.
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
