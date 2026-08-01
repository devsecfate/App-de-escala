# Arquitetura Técnica

Detalhes de stack, modelo de dados e permissões. Visão de produto e roadmap ficam em `planejamento/planejamento.md`.

## Stack

- **Front-end:** React + TypeScript + Vite, Tailwind para estilo, `vite-plugin-pwa` para instalação e cache offline de leitura.
- **Back-end:** Supabase — Postgres, Auth (e-mail/senha + link mágico) e Row Level Security como camada real de permissão. Edge Functions só onde precisar de segredo (envio de WhatsApp).
- **Deploy:** Vercel (web) + projeto Supabase gerenciado. Migrations versionadas em `supabase/migrations/` via Supabase CLI.
- **Testes:** Vitest nas regras de negócio puras.

## Preparação para o app nativo

O código nasce separado em duas camadas, para que o app futuro (Fase 6) reaproveite o essencial:

- `packages/core/` — **sem nenhuma dependência de DOM**: tipos do domínio, funções puras de regra (`validarEscalacao`, `pessoasDisponiveis`, `conflitosDoEvento`) e o cliente Supabase com as queries. É esse pacote que o app nativo (Expo / React Native) vai importar inteiro.
- `apps/web/` — telas, roteamento e componentes, específicos da web.

Só a camada de UI é reescrita quando o app nativo entrar. *Alternativa considerada e descartada por ora:* Expo + React Native Web desde o início — um só código para tudo, mas com PWA mais frágil e DX pior para as telas de tabela/calendário que dominam este app.

## Modelo de dados (Postgres)

Multi-tenant por igreja, porque os documentos já preveem outras igrejas usando o app.

| Tabela | Campos principais |
|---|---|
| `igrejas` | id, nome, fuso_horario |
| `perfis` | id (= auth.users.id), igreja_id, nome, telefone, email, papel_global (`admin` \| `membro`), ativo |
| `ministerios` | id, igreja_id, nome, descricao, ordem, ativo |
| `membros_ministerio` | id, ministerio_id, perfil_id, papel (`lider` \| `membro`), ativo |
| `funcoes` | id, ministerio_id, nome (ex: vocal, projeção, som) |
| `membro_funcoes` | membro_ministerio_id, funcao_id |
| `eventos` | id, igreja_id, titulo, data_hora, tipo, observacoes |
| `escalas` | id, evento_id, ministerio_id, status (`rascunho` \| `publicada`), publicada_em, criada_por |
| `escalacoes` | id, escala_id, perfil_id, funcao_id, confirmacao (`pendente` \| `confirmado` \| `recusado`), respondido_em |
| `indisponibilidades` | id, perfil_id, data_inicio, data_fim, motivo |
| `regras_ministerio` | id, ministerio_id, max_escalas_mes, intervalo_min_dias, bloquear_conflito_evento |
| `musicas` | id, ministerio_id, titulo, artista, tom, andamento, categoria, link, ativa, extras (jsonb) |
| `categorias_musica` | id, ministerio_id, nome, ordem |
| `cronograma_itens` | id, escala_id, musica_id, ordem, tom_do_dia, momento, observacao |
| `envios` | id, escala_id, canal, status, enviado_em |

O `extras jsonb` em `musicas` é o que sustenta a promessa de `repertorio/louvores.md` de colunas configuráveis pelo líder, sem campos fixos.

## Permissões (RLS)

Funções auxiliares em SQL — `minha_igreja()`, `e_lider(ministerio_id)`, `e_admin()` — usadas nas policies:

- Tudo é filtrado por `igreja_id = minha_igreja()`.
- `escalas` e `escalacoes`: escrita só se `e_lider(ministerio_id)`; leitura para qualquer membro da igreja quando `status = 'publicada'`, e só para o líder quando rascunho.
- `escalacoes.confirmacao`: a própria pessoa pode atualizar apenas a sua linha.
- `ministerios`, `funcoes`, `regras_ministerio`: escrita para admin; líder edita as funções e regras do próprio ministério.
- `indisponibilidades`: a pessoa escreve a sua; o líder do ministério dela lê.

Isso implementa no banco a regra do `regras/regras.md`: *"cada líder só pode montar e editar a escala do ministério que lidera"* — a UI apenas reflete o que o banco já garante.

## Motor de regras (`packages/core/regras.ts`)

Funções puras que recebem estado e devolvem `{ bloqueios: [], avisos: [] }`:

- **Bloqueio:** pessoa não pertence ao ministério; pessoa marcada como indisponível na data; escalar duas vezes na mesma função do mesmo evento.
- **Aviso:** já escalada em outro ministério no mesmo evento; passou do `max_escalas_mes`; intervalo desde a última escala menor que `intervalo_min_dias`; função obrigatória do ministério ainda vazia.

Separar bloqueio de aviso é intencional — em igreja pequena a mesma pessoa às vezes precisa servir em dois lugares, e o app não deve impedir, só alertar.

## WhatsApp

Em duas etapas, para não travar o MVP em burocracia:

1. **Fase 3:** o app gera o texto formatado da escala e abre o WhatsApp com ele pronto (link `wa.me` / Web Share API). O líder envia no grupo. Zero custo e zero cadastro.
2. **Depois:** WhatsApp Cloud API (Meta) via Edge Function para lembretes automáticos — exige conta business, templates aprovados e tem custo por conversa. APIs não-oficiais ficam fora: risco de banimento do número.

Notificação push do PWA entra junto na Fase 3 como complemento gratuito.
