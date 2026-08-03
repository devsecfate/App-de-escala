# Etapa 6 — Conta própria, poder corrigir, e um app que não é feio

## Contexto

O app está em produção e funciona, mas três coisas o impedem de ser entregue para a igreja:

1. **Não existe cadastro.** `Login.tsx` pede e-mail e senha, mas nada no repositório chama `signUp` — o que realmente cria conta hoje é o link mágico (`signInWithOtp` com `shouldCreateUser` no default), escondido como link sublinhado cinza embaixo do formulário. Quem é convidado por um líder nunca define senha, e não há "esqueci minha senha". Foi exatamente onde o usuário travou.
2. **Cria e nunca desfaz.** Evento, ministério e função têm botão de criar e nenhum de editar ou excluir — e as *policies* de RLS para isso **já existem no banco**; falta função no core e botão na tela. Pior: quatro funções `remover*` não checam se alguma linha saiu, e como o PostgREST devolve sucesso com zero linhas quando a RLS filtra, o botão "funciona" e o item volta sem explicação.
3. **Não existe camada de design.** `apps/web/src/index.css` tem uma linha (`@import "tailwindcss"`). Zero tokens, zero fonte, zero cor de marca — o app é 82,7% `slate` porque é o cinza de fábrica do Tailwind. Não há um único componente de UI: o "card" está copiado 21 vezes, o input 40, o botão 15. `text-sm` aparece 156 vezes, então título de página e parágrafo têm quase o mesmo peso. Não há transição nenhuma, nem ícone, nem barra inferior, e os alvos de toque têm ~30px (mínimo recomendado: 44px).

Resultado esperado: qualquer pessoa da igreja cria a própria conta com nome, e-mail e senha, entra com um código que o líder mandou, corrige o que criou errado, e usa um app que parece um aplicativo.

## Decisões já tomadas

| Assunto | Decisão |
|---|---|
| Entrar na igreja | **Código de convite gerado pelo líder, com validade e limite de usos.** Não depende de e-mail. |
| Confirmação de e-mail | **Sem confirmação** — cria a conta e já entra. Quem não tem convite não enxerga nada (RLS por igreja). |
| Excluir com histórico | **Arquivar.** Some das listas, escalas antigas e relatórios intactos, dá para desarquivar. O que nunca foi usado some de vez. A confirmação diz qual dos dois vai acontecer. |
| Paleta / fonte | Azul-petróleo `#0F766E` + cinza `#F8FAFC` / `#0F172A`, sucesso `#16A34A`, atenção `#CA8A04`. Fonte **Inter**. |
| Movimento | **Vivo + efeitos de superfície**: transições, cascata na lista, esqueletos, header de vidro, gradiente no cartão da próxima escala, glow no botão, número contando no relatório, modal com mola. Respeitando `prefers-reduced-motion`. |

## Ordem de entrega

Três etapas, cada uma testável de ponta a ponta. A fundação visual vem junto com a Etapa 1 porque toda tela nova precisa nascer em cima dela — restilizar depois seria fazer duas vezes.

---

# Etapa 1 — Fundação visual + criar conta e entrar

## 1.1 Tema

`apps/web/src/index.css` — trocar a única linha por `@import "tailwindcss"` + um bloco `@theme` com:

- Cores: `--color-marca-*` (escala 50→950 a partir de `#0F766E`), `--color-fundo`, `--color-superficie`, `--color-borda`, `--color-texto`, `--color-texto-suave`, e semânticas `sucesso` / `atencao` / `perigo`.
- Fonte: `--font-sans` com Inter à frente da stack de sistema.
- Raio, sombras (incluindo uma sombra colorida na cor da marca para o glow do botão), durações e curvas de animação (`--duracao-rapida: 150ms`, `--mola: cubic-bezier(...)`).
- `@media (prefers-reduced-motion: reduce)` zerando durações globalmente.
- `env(safe-area-inset-*)` como variáveis, para a barra inferior não ficar embaixo do home indicator do iPhone.

**Fonte auto-hospedada, não Google Fonts:** o app precisa abrir offline (Fase 5), e requisição externa quebra sem rede. Adicionar `@fontsource-variable/inter` como dependência e importar no `main.tsx`.

⚠️ **Cuidado que vale a etapa inteira:** `apps/web/vite.config.ts:28` usa `strategies: "injectManifest"`, cujo `globPatterns` padrão **não inclui `woff2`**. Sem adicionar `injectManifest: { globPatterns: [...] }` com `woff2`, a fonte não entra no precache e o app offline volta para a fonte do sistema. Conferir depois do build que o `sw.js` gerado lista o `.woff2`.

Também no `vite.config.ts` e no `index.html`: trocar `theme_color` / `background_color` / `<meta name="theme-color">` de `#0f172a` para a nova cor da marca.

## 1.2 Primitivos de UI — `apps/web/src/components/ui/`

Nove componentes que absorvem as ~130 repetições de classe medidas hoje:

| Componente | Substitui |
|---|---|
| `Botao` | variantes `primario` / `secundario` / `perigo` / `fantasma`, `carregando`, altura mínima 44px, glow e press |
| `Card` | as 21 cópias de `rounded-xl border border-slate-200 bg-white` |
| `Campo` | input / select / textarea **com `<label>` sempre associado** (hoje 20 campos só têm placeholder) |
| `Badge` | as cores de estado; um `BadgeConfirmacao` único acaba com a duplicação de `rotuloConfirmacao` entre `Home.tsx:9` e `MontarEscala.tsx:51`, que hoje divergem no texto |
| `Alerta` | as 15 cópias de `<p className="text-sm text-red-600">`, com `role="alert"` |
| `Modal` + `ConfirmarAcao` | **não existe nada disso hoje** — nenhum botão destrutivo pede confirmação |
| `EstadoVazio` | as 10 mensagens de vazio com redação e margem diferentes (3 delas renderizadas como `<li>` dentro da própria lista) |
| `Esqueleto` | as 9 cópias de `Carregando...` em texto cinza |
| `TituloPagina` / `Secao` | hierarquia tipográfica de verdade |

Dois utilitários novos:
- `apps/web/src/lib/formato.ts` — uma `formatarDataHora` só (hoje há **três**, com opções divergentes, em `Home.tsx:15`, `Eventos.tsx:8` e `MontarEscala.tsx:41`).
- `apps/web/src/lib/movimento.ts` — variantes e molas compartilhadas, mais um hook `usaMovimentoReduzido()`.

Dependências novas: `motion` (sucessor do `framer-motion`; conferir o nome do pacote na instalação), `lucide-react` para ícones — hoje os "ícones" são os caracteres `→ ↑ ↓ ×` soltos no JSX. Vigiar o bundle: hoje ~464 KB, o teto aceitável é ~600 KB.

## 1.3 Layout novo — `apps/web/src/components/Layout.tsx`

Hoje é um header de dashboard (`max-w-4xl`, 4 links de texto numa linha só, sem `flex-wrap`) que estoura num iPhone SE.

- **Celular:** barra inferior fixa com ícone + rótulo, indicador que desliza entre as abas, respeitando safe-area.
- **Desktop (`sm:`):** barra no topo, como hoje mas com respiro.
- Header de vidro (`backdrop-blur`) com o conteúdo passando por baixo ao rolar.
- Transição entre rotas via `viewTransition` do React Router 7 nos `NavLink`, com fallback em `motion` onde a API não existir.
- `Login`, `Cadastrar` e `Onboarding` ganham um shell próprio (`AuthLayout`) com o ícone do app — o `pwa-icon.svg` existe em `public/` e **nunca é usado dentro da UI**.

## 1.4 Banco — migration `20260803xxxxxx_convites_e_conta.sql`

```sql
create table convites (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igrejas (id) on delete cascade,
  ministerio_id uuid references ministerios (id) on delete cascade,  -- null = entra só na igreja
  codigo text not null unique,
  nome_sugerido text,
  papel text not null default 'membro' check (papel in ('lider','membro')),
  usos_max int not null default 1 check (usos_max between 1 and 100),
  usos int not null default 0,
  expira_em timestamptz not null,
  cancelado_em timestamptz,
  criado_por uuid references perfis (id) on delete set null,
  created_at timestamptz not null default now()
);
```

Três funções `security definer` (mesmo idioma do `criar_igreja` existente em `20260801051737_rls_policies.sql:97`):

- `gerar_codigo_convite()` — 8 caracteres do alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sem `O/0/I/1/L`, que a pessoa lê errado ao digitar), com repetição em caso de colisão. Exibido como `XXXX-XXXX`.
- `criar_convite(p_ministerio_id, p_papel, p_nome_sugerido, p_usos_max, p_valido_por_dias default 7)` — exige `e_lider(p_ministerio_id)`, força `igreja_id = minha_igreja()` e `criado_por = auth.uid()` para não serem forjados.
- `usar_convite(p_codigo)` — normaliza (maiúsculas, ignora hífen/espaço), valida nesta ordem com mensagens distintas em português: não existe → cancelado → expirado → esgotado. Depois insere em `perfis` e faz `insert ... on conflict (ministerio_id, perfil_id) do update set ativo = true` em `membros_ministerio` (a constraint única já existe, `schema_inicial.sql:57`), e incrementa `usos`. Recusa se a pessoa já tem perfil.

Nome do perfil: `coalesce(user_metadata->>'nome', nome_sugerido, email)`.

Mais três correções na mesma migration:

- **`criar_igreja` lê o nome errado.** Hoje faz `auth.jwt() ->> 'name'`, mas o nome fica em `user_metadata`, então o `coalesce` **sempre** cai no e-mail e todo admin nasce com `nome = e-mail`. Passa a ler `auth.jwt() -> 'user_metadata' ->> 'nome'`, com o novo cadastro gravando lá.
- **Furo de segurança:** `perfis_update_propria` (`rls_policies.sql:168`) deixa qualquer pessoa dar `PATCH` na própria linha incluindo `papel_global` — ou seja, **virar admin da igreja sozinha**. RLS filtra linha, não coluna. Corrigir com um trigger, igual ao `escalacoes_restringe_update` que já existe (`rls_policies.sql:336`) e foi criado exatamente por esse motivo.
- RLS de `convites` (select/insert/update/delete por `e_lider` ou `e_admin`) + **repetir os `grant ... to authenticated, service_role`**: o projeto não usa `alter default privileges`, e o cabeçalho de `20260801233000_grants_authenticated.sql:14` avisa que toda migration nova precisa repetir o grant. Sem isso, tudo responde "permission denied" mesmo com a RLS certa — já aconteceu neste projeto.

## 1.5 Core — `packages/core/src/api/convites.ts` (novo)

`criarConvite`, `listarConvites`, `cancelarConvite`, `usarConvite`, e `textoConviteWhatsApp(convite, urlDoApp)` reaproveitando o idioma de `texto-escala.ts`. Registrar em `packages/core/src/index.ts` (barrel na linha 10+).

## 1.6 Autenticação no app

`apps/web/src/context/AuthContext.tsx`:
- `cadastrar(nome, email, senha)` → `signUp` com `options.data.nome`.
- `enviarRedefinicaoDeSenha(email)` e `definirNovaSenha(senha)`.
- Depois de logar sem perfil, tentar `usar_convite` se houver código guardado; só então mandar para o onboarding.
- **Corrigir o bug de rota:** o cálculo de `carregando` na linha 78 abre uma janela em que `session` existe, `perfil` ainda é `null` e `carregando` já é `false`. Como o efeito do filho roda antes do efeito do `AuthProvider`, **toda recarga de página salta para `/onboarding`** e volta — qualquer deep link se perde no refresh. Iniciar `carregandoPerfil` em `true` quando há sessão.

Telas:
- `Login.tsx` reescrito: e-mail + senha como caminho principal, **"Criar conta"** e **"Esqueci minha senha"** visíveis, erros do Supabase traduzidos (hoje chega `error.message` cru em inglês).
- `Cadastrar.tsx` (novo): nome, e-mail, senha, e campo opcional **"Código do convite"** pré-preenchido por `?convite=`.
- `Onboarding.tsx` reescrito: duas portas — **"Tenho um código"** (principal) e **"Sou eu quem administra a igreja"** (cria a igreja, pedindo também o nome da pessoa e o fuso).
- `App.tsx`: rotas `/cadastrar`, `/redefinir-senha` e uma rota `*` (hoje URL desconhecida renderiza tela em branco).

## 1.7 Configuração do Supabase

`supabase/config.toml`: manter `enable_confirmations = false`. Em produção, ligar `mailer_autoconfirm` (hoje está `false`, o que exigiria e-mail que não é entregue para ninguém além do dono do projeto). Documentar no `DEPLOY.md`.

**Nota:** a conta atual (`guibeloliv@gmail.com`) nasceu por link mágico e **não tem senha**. Depois do deploy, definir a senha por "Esqueci minha senha" — o SMTP embutido entrega para o dono do projeto, então funciona.

---

# Etapa 2 — Telas do dia a dia + poder corrigir

Redesenhar com os primitivos e o movimento: `Home.tsx`, `Eventos.tsx`, `Ministerios.tsx`, `Disponibilidade.tsx`.

Destaques: cartão da próxima escala com gradiente e borda que brilha; lista entrando em cascata; esqueleto no lugar de "Carregando..."; ao confirmar presença o badge vira ✓ com o check se desenhando; e os dois banners de sistema (`InstalarApp` + `AtivarAvisos`) deixam de aparecer **antes** da escala na Home.

**Migration 2:** `alter table eventos add column ativo boolean not null default true` e o mesmo em `funcoes` (`ministerios.ativo` e `perfis.ativo` já existem no schema — nunca ninguém escreveu neles). Mais a policy de DELETE que falta em `envios`, hoje a única tabela de negócio onde um delete seria no-op silencioso. Repetir os grants.

**Core, funções novas** (mesmo idioma de `eventos.ts`: `mapX`, `COLUNAS_X`, `throw error`):

| Arquivo | Adicionar |
|---|---|
| `api/eventos.ts` | `atualizarEvento`, `definirEventoAtivo`, `removerEvento`, `contarEscalacoesDoEvento` |
| `api/ministerios.ts` | `atualizarMinisterio`, `definirMinisterioAtivo`, `removerMinisterio` |
| `api/indisponibilidades.ts` | `atualizarIndisponibilidade` |
| `api/perfis.ts` | `atualizarPerfil`, `definirPerfilAtivo` |
| `api/igrejas.ts` | `atualizarIgreja` (nome e fuso — o fuso alimenta todo o relatório e hoje é chumbado no onboarding) |

**Correção transversal:** toda função `remover*` / `atualizar*` passa a usar `.select("id")` e a lançar erro explícito quando nenhuma linha volta. Sem isso a RLS filtra em silêncio e o usuário vê o item reaparecer. Vale para `removerCategoriaMusica`, `removerCampoMusica`, `removerItemCronograma`, `removerIndisponibilidade` e o `.delete()` dentro de `definirEscalacao`. Corrigir também os dois `.then(carregar)` **sem `.catch`** em `Repertorio.tsx:360` e `:401`, onde o erro vira unhandled rejection e nunca chega ao `setErro`.

`listarMinhasEscalacoes` e `listarProximosEventos` passam a filtrar evento inativo.

**Regra de exclusão, aplicada em toda parte:** antes de abrir o `ConfirmarAcao`, contar o histórico. Sem histórico → "Excluir 'X'? Nunca foi usado." Com histórico → "'X' já aparece em 12 escalas. Vou arquivar: some das listas, mas o histórico e o relatório continuam certos. Dá para desarquivar depois."

---

# Etapa 3 — Telas do líder

Redesenhar `MinisterioDetalhe.tsx` (404 linhas), `MontarEscala.tsx` (501), `Repertorio.tsx` (431), `Relatorio.tsx` (316) — as quatro mais densas. No relatório entram os números contando de zero e as barras crescendo.

Completar o editar/excluir que falta:

| Entidade | O que entra |
|---|---|
| `funcoes` | `atualizarFuncao`, `definirFuncaoAtiva`, `removerFuncao`. Hoje são chips estáticos sem nenhum controle; errou o nome, é para sempre. Arquivar em vez de excluir importa: `escalacoes.funcao_id` é **cascade**, então apagar "Guitarra" apagaria as escalações históricas em guitarra e mudaria o relatório retroativamente. |
| `categorias_musica`, `campos_musica` | `atualizar*` (renomear/reordenar) — hoje só dá para criar e apagar. Renomear um campo precisa migrar a chave dentro de `musicas.extras`, senão os valores digitados ficam órfãos no jsonb. |
| `musicas` | `removerMusica` de verdade para música nunca usada — o `on delete restrict` em `cronograma_itens.musica_id` já protege o resto sozinho. |
| `escalas` | `despublicarEscala` e `removerEscala` para rascunho vazio. Hoje a escala nasce **só por abrir a URL** (`MontarEscala.tsx:96`) e rascunhos fantasma se acumulam sem como listar nem apagar. |
| `convites` | Tela de convites do ministério: lista com validade e usos, botão de copiar a mensagem de novo, e cancelar. |
| Membro | O "Remover" atual não avisa que o líder pode remover **a si mesmo** e deixar o ministério sem quem administre. Bloquear o último líder. |

---

## Riscos e cuidados

1. **`woff2` fora do precache** (§1.1) — quebra a fonte offline sem quebrar o build. Conferir no `sw.js` gerado.
2. **Grants esquecidos numa migration nova** — responde "permission denied" com a RLS aparentemente correta. Já derrubou o app inteiro neste projeto.
3. **Cascatas de exclusão** — `ministerios` tem **7 FKs cascade** apontando para ele, e `escalas` cascateia mais uma camada. É por isso que a regra é arquivar. Nenhum `DELETE` de ministério ou evento com histórico deve existir no código.
4. **Bundle** — `motion` + `lucide-react` + Inter. Medir antes e depois.
5. **A suíte de integração precisa de banco limpo** — `fluxo.integracao.test.ts` conta linhas do seed. Rodar `npx supabase db reset` antes.
6. `packages/core/src/datas.ts` e `lembretes.ts` **não podem importar outro módulo do core** — a Edge Function os importa por caminho relativo e o Deno não resolve os `.js`. Não encostar neles.

## Verificação

Ao fim de cada etapa:

1. `npm test` (62 testes puros) e `npm run lint` (`tsc -b`, três tsconfigs).
2. `npx supabase db reset` + `npm run test:integracao` (25 testes contra Postgres real; Docker Desktop aberto).
3. **Testes novos**: `convites.integracao.test.ts` cobrindo código expirado, cancelado, esgotado, código de outra igreja, e a pessoa que já tem perfil. Mais um teste do trigger que impede a auto-promoção a `admin`. Mais testes de arquivar/excluir garantindo que o relatório não muda quando algo é arquivado.
4. `npm run build` e conferir no `dist/sw.js`: precache com o `.woff2`, as duas rotas de offline, e o bundle dentro do teto.
5. Navegador, via claude-in-chrome: criar conta do zero, criar igreja, gerar um código, abrir numa janela anônima, criar a segunda conta com o código, conferir que ela caiu no ministério certo. Depois errar de propósito — criar um evento com data errada e corrigir, criar uma função com nome errado e apagar.
6. Celular, com o roteiro que fecha a Fase 5: instalar, abrir pelo atalho, recarregar em modo avião, ativar avisos, sair e conferir que o cache sumiu.

## Fora de escopo

Tema escuro (os tokens ficam prontos para ele, mas não vou implementar agora); SMTP próprio; app nativo com Expo (a Fase 6 do planejamento original); o aviso de segurança pendente do `react-router`. O `DEPLOY.md` tem alterações não commitadas da sessão passada, que entram no primeiro commit desta etapa.
