# Planejamento do App de Escala

Visão de produto e roadmap. Detalhes técnicos (stack, banco de dados, permissões) ficam em `planejamento/arquitetura.md`.

## Decisões de plataforma

- Começar como **web responsivo / PWA** (instalável no celular, funciona no navegador).
- **App nativo** (Play Store / App Store) é objetivo futuro — a arquitetura já é preparada para isso desde o início (ver `arquitetura.md`).
- Dados e login em **Supabase**.

## Personas

- **Administrador da igreja** — cria a igreja, cadastra ministérios e define os líderes.
- **Líder de ministério** — monta, edita e publica a escala do próprio ministério; cadastra as pessoas dele.
- **Pessoa que serve** — vê as próprias escalas, confirma presença, marca datas indisponíveis.

## Telas

1. **Login / convite** — e-mail + senha ou link mágico; entrada de novos membros por convite do líder.
2. **Onboarding da igreja** — admin cria a igreja e escolhe os ministérios (lista de `ministerios/ministerios.md` pré-preenchida e editável).
3. **Minhas escalas (home)** — próximos compromissos da pessoa, com botões *Confirmar* / *Não posso*.
4. **Agenda** — calendário mensal de eventos (culto, ensaio, evento), filtro por ministério.
5. **Montar escala** (líder) — escolhe o evento, vê as funções do ministério e as pessoas disponíveis; o app sinaliza indisponibilidade, conflito com outro ministério no mesmo horário e estouro dos limites das regras. Salva como *rascunho* e depois *publica*.
6. **Pessoas do ministério** (líder) — convidar, editar contato, marcar funções que a pessoa exerce, definir outro líder.
7. **Minha disponibilidade** — pessoa marca períodos em que não pode servir.
8. **Repertório** (louvor) — lista de músicas com campos configuráveis + montagem do cronograma do culto (ordem, tom do dia, momento).
9. **Compartilhar escala** — gera o texto pronto da escala e abre o WhatsApp com ele.
10. **Configurações da igreja** (admin) — ministérios, tipos de evento, regras padrão.

## Escopo confirmado

Além do básico (cadastro de ministérios, pessoas e montagem da escala):

- Indisponibilidade de datas
- Confirmação de presença
- Avisos por WhatsApp
- Repertório de louvor

## Fases de entrega

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0. Fundação** | Monorepo (`apps/web` + `packages/core`), Vite/React/TS/Tailwind, projeto Supabase, migrations do schema, RLS, login, deploy na Vercel | Dá para logar e ver uma tela vazia no ar |
| **1. MVP da escala** | Igreja, ministérios, pessoas, funções, eventos; montar escala em rascunho, publicar; tela "minhas escalas" | Um líder monta e publica a escala do mês e as pessoas veem |
| **2. Disponibilidade e confirmação** | Indisponibilidade por período, confirmar/recusar, painel do líder com quem confirmou; motor de regras ligado na tela de montagem | O líder monta a escala já vendo quem não pode |
| **3. Avisos** | Texto pronto + envio por WhatsApp, push do PWA, lembrete de véspera | O líder compartilha a escala em dois toques |
| **4. Repertório de louvor** | Músicas com campos configuráveis, categorias, cronograma do culto ligado à escala | O líder de louvor monta o cronograma junto com a escala |
| **5. Acabamento** | Instalação como app (PWA), leitura offline, relatório de quantas vezes cada pessoa serviu no período | Instalável no celular e roda sem internet para consulta |
| **6. App nativo** | Expo / React Native importando `packages/core`, publicação nas lojas | App na Play Store / App Store |

## Fora de escopo por enquanto

Controle financeiro, presença/frequência histórica além do relatório simples da Fase 5, integração com Google Agenda (fica como candidata em `ferramentas/`) e escala automática gerada por algoritmo — o líder monta na mão, como os documentos definem.

## Verificação de cada fase

- **Local:** `npm run dev` em `apps/web` e `supabase start` para o banco local com as migrations aplicadas.
- **Seed:** script que popula os 7 ministérios de `ministerios/ministerios.md` e algumas pessoas fictícias, para testar sem cadastrar tudo à mão.
- **Regras:** `npm test` — casos do motor de regras (pessoa fora do ministério, data indisponível, estouro de limite mensal, conflito entre ministérios).
- **Permissões (o teste mais importante):** com dois usuários reais, confirmar que o líder do ministério A não consegue editar a escala do ministério B, nem pela UI nem chamando a API do Supabase direto.
- **Fluxo ponta a ponta:** admin cria igreja → cadastra Louvor e define um líder → líder convida 3 pessoas → uma marca indisponibilidade → líder monta a escala e vê o aviso → publica → a pessoa confirma → líder compartilha no WhatsApp.
- **PWA:** Lighthouse com o app instalável e a agenda abrindo offline.
