# Ferramentas

Lista de ferramentas, integrações e tecnologias usadas no app.

## Definidas (ver `planejamento/arquitetura.md`)

| Ferramenta | Uso | Por quê |
|---|---|---|
| React + TypeScript + Vite | Front-end web | Ecossistema maduro, DX boa para telas de tabela/calendário |
| Tailwind CSS | Estilo | Rapidez de estilização sem CSS separado |
| `vite-plugin-pwa` | Instalação e cache offline | App instalável no celular sem loja de aplicativo |
| Supabase (Postgres + Auth + RLS) | Banco de dados, login e permissões | Plano gratuito atende uma igreja; RLS garante no banco que líder só edita o próprio ministério |
| Supabase Edge Functions | Envio de WhatsApp (fase futura) | Só onde precisa de segredo, sem expor chave no front |
| Vercel | Deploy do front-end | Deploy simples integrado ao Git |
| Vitest | Testes das regras de negócio | Regras puras testáveis sem UI |
| WhatsApp (`wa.me` / Web Share API) | Compartilhar escala (Fase 3) | Zero custo, zero cadastro; líder envia no grupo já existente |
| WhatsApp Cloud API (Meta) | Lembretes automáticos (depois da Fase 3) | Envio automático, mas exige conta business e tem custo por conversa |

## Candidatas (fora do escopo atual)

- Google Agenda, para sincronizar datas de eventos.
- Expo / React Native, para o app nativo (Fase 6), reaproveitando `packages/core`.
