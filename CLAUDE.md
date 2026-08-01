# CLAUDE.md

Memória de trabalho do projeto App de Escala. Leia este arquivo primeiro para pegar o contexto rápido; os detalhes completos ficam em `memoria/memoria.md`.

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

(nenhuma registrada ainda)
