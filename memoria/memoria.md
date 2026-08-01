# Memória do Projeto

Contexto acumulado sobre o app de escala. Atualize este arquivo conforme decisões e informações relevantes forem surgindo.

## Sobre o app

App para organizar a escala de pessoas que servem na igreja, separando por ministério, deixando o processo mais simples e organizado.

## Decisões tomadas

- Os líderes de cada ministério devem conseguir montar a própria escala direto pelo app, sem intermediário.

- Plataforma: começar como **web responsivo / PWA**; **app nativo** é objetivo futuro (Fase 6), com arquitetura já preparada para reaproveitar a lógica (`packages/core`).
- Dados e login em **Supabase** (Postgres + Auth + Row Level Security).
- Escopo confirmado além do básico: indisponibilidade de datas, confirmação de presença, avisos por WhatsApp, repertório de louvor.
- Regras de escala separadas em **bloqueio** (o app impede) e **aviso** (o app avisa, líder decide) — ver `regras/regras.md`.

## Pendências e dúvidas

(nenhuma registrada ainda)

## Histórico de mudanças

- 2026-07-31: repositório criado, estrutura inicial definida.
- 2026-07-31: definido que líderes montam a escala do próprio ministério pelo app.
- 2026-07-31: criado CLAUDE.md como memória de trabalho rápida do projeto.
- 2026-07-31: criada biblioteca de louvores predefinidos (`repertorio/louvores.md`) para facilitar o cronograma do ministério de louvor.
- 2026-07-31: biblioteca de louvores ajustada para ser totalmente configurável pelo líder, sem valores fixos.
- 2026-07-31: cadastrados os ministérios da igreja (Tecnologia, Mídias, Louvor, Acolhimento, Evangelismo, Social, Espiritualidade), mantendo a lista configurável para outras igrejas.
- 2026-08-01: criado planejamento completo em `planejamento/` (produto + arquitetura técnica): plataforma web/PWA primeiro com app nativo depois, Supabase como banco/login, escopo com indisponibilidade + confirmação + WhatsApp + repertório, e roadmap em 7 fases (0 a 6).
- 2026-08-01: Fase 0 (fundação técnica) concluída — monorepo, schema + RLS no Supabase, login funcional. Código publicado em https://github.com/devsecfate/App-de-escala.
- 2026-08-01: Fase 1 (MVP da escala) concluída — onboarding (criar igreja), CRUD de ministérios/funções/membros/eventos, convite de membro por e-mail (Edge Function `convidar-membro`, usando o RPC `e_lider` já existente para checar permissão), montagem e publicação de escala por função, e "Minhas escalas" ligada a dados reais. As policies de RLS escritas na Fase 0 cobriram todos os fluxos novos sem precisar de migration adicional.
