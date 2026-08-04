# Deploy

Passo a passo para colocar o app no ar: **Supabase cloud** (banco, login e Edge Functions) e **Vercel** (o app web).

A ordem importa: o Supabase vem primeiro, porque a URL e a chave anônima dele entram no build do front.

---

## 1. Supabase cloud

### 1.1 Entrar e criar o projeto

```bash
npx supabase login
```

Comando interativo (abre o navegador) — rode você mesmo. No painel https://supabase.com/dashboard, crie o projeto:

- **Region:** `South America (São Paulo)` — o app é para uma igreja no Brasil, e a latência aparece em cada tela.
- **Database password:** guarde num gerenciador de senhas. Ela não é a senha do login do app; é a do Postgres, e só aparece uma vez.

Anote o **project ref** (o `abcdefghijklm` de `https://abcdefghijklm.supabase.co`).

### 1.2 Aplicar as migrations

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Os dois pedem a senha do banco (a de 1.1) no terminal, então rode você mesmo.

Isso aplica as migrations de `supabase/migrations/` na nuvem, incluindo a de GRANTs — sem ela, toda query responde "permission denied" mesmo com RLS correta.

**O `supabase/seed.sql` não vai para a nuvem**, de propósito: ele cria usuários de teste com senha conhecida. Na nuvem, a igreja nasce pelo caminho real — você se cadastra pelo app e a tela de onboarding cria a igreja e te deixa admin.

### 1.3 Endereço do app no login (o erro clássico)

No painel: **Authentication → URL Configuration**.

- **Site URL:** a URL da Vercel (ex.: `https://app-de-escala.vercel.app`)
- **Redirect URLs:** a mesma URL com `/*` no fim

Sem isso, o link mágico e o link de "esqueci minha senha" mandam a pessoa para `localhost:3000` — "não funciona" e não é óbvio por quê.

### 1.4 Cadastro sem confirmação de e-mail

No painel: **Authentication → Sign In / Providers → Email**.

- **Confirm email:** **desligado** (equivale a `mailer_autoconfirm = true`).
- **Allow new users to sign up:** ligado.

Isto é decisão de produto da Etapa 6, não descuido. O projeto não tem SMTP próprio, e o servidor embutido do Supabase entrega **só para o e-mail do dono do projeto**: com a confirmação ligada, ninguém da igreja passaria da primeira tela — o app ficaria inaugurado e inutilizável.

Não abre buraco: quem cria uma conta sem convite **não enxerga absolutamente nada**. A RLS isola tudo por igreja e, sem perfil, `minha_igreja()` é `null` e nenhuma policy casa. Quem dá acesso é o **código do convite** gerado pelo líder, não o e-mail.

O mesmo vale localmente — `enable_confirmations = false` em `supabase/config.toml`.

### 1.5 E-mail de verdade (opcional)

O SMTP embutido serve para testar e só: poucos e-mails por hora e **só para endereços da sua organização**.

Depois da Etapa 6, **entrar na igreja não depende mais de e-mail**: o líder gera um código no app e manda por onde quiser. O e-mail só é usado para "Esqueci minha senha".

Para a igreja usar o "esqueci minha senha" de verdade, configure SMTP próprio em **Project Settings → Auth → SMTP Settings** (Resend, Brevo, Amazon SES — todos com camada gratuita suficiente para uma igreja).

> **A conta `guibeloliv@gmail.com` de produção nasceu por link mágico e não tem senha.** Para definir uma: na tela de login, "Esqueci minha senha". O SMTP embutido entrega para o dono do projeto, então esse caso específico funciona sem configurar nada.

### 1.6 Edge Functions

```bash
npx supabase functions deploy convidar-membro
npx supabase functions deploy enviar-lembretes
```

`convidar-membro` não precisa de segredo (usa as variáveis que o Supabase já injeta). `enviar-lembretes` precisa:

```bash
# 1. Gere o par VAPID uma vez e guarde as duas chaves:
deno eval 'import w from "npm:web-push@^3.6.7"; console.log(w.generateVAPIDKeys())'

# 2. Configure os segredos:
npx supabase secrets set \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:contato@suaigreja.com \
  LEMBRETES_SECRET=$(openssl rand -hex 32)
```

A chave **pública** também vai para a Vercel, como `VITE_VAPID_PUBLIC_KEY`. A privada nunca sai daqui.

### 1.7 Lembrete diário

Com o projeto no ar, o agendamento finalmente tem onde existir. No **SQL Editor** do painel:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'lembretes-vespera', '0 21 * * *',   -- 18h de Brasília
  $$ select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/enviar-lembretes',
       headers := '{"x-lembretes-secret": "<LEMBRETES_SECRET>"}'::jsonb
     ) $$
);
```

Confira depois com `select * from cron.job;`.

### 1.8 Chaves legadas desligadas

O Supabase entrega dois conjuntos de chaves: as **legadas** (`anon` e
`service_role`, JWTs estáticos assinados em HS256) e as **novas**
(`sb_publishable_...` e `sb_secret_...`). A `service_role` legada ignora RLS e
dá acesso total ao banco — é a chave que nunca pode vazar.

Neste projeto as legadas foram desligadas via API:

```bash
curl -X PUT "https://api.supabase.com/v1/projects/<project-ref>/api-keys/legacy?enabled=false" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

(O `enabled` vai como parâmetro de query, não no corpo — no corpo a API responde
400 dizendo que o campo é `undefined`.)

Depois de desligar, quem usar uma chave legada leva
`401 Legacy API keys are disabled`. Verificado que continua tudo funcionando: o
front com a chave publicável e a Edge Function `enviar-lembretes`, que segue
recebendo `SUPABASE_SERVICE_ROLE_KEY` injetada pela plataforma. Se um dia essa
injeção parar, o conserto é a função passar a ler a chave secreta nova.

Para religar (não recomendado): mesma URL com `enabled=true`.

---

## 2. Vercel

O `vercel.json` na raiz já traz o que a Vercel precisa saber:

- build pela raiz (`npm run build`, que typecheca o core antes), saída em `apps/web/dist`;
- rewrite de SPA, para `/eventos` e `/ministerios/:id` abrirem direto (a Vercel checa o sistema de arquivos antes dos rewrites, então `sw.js`, manifest e ícones continuam sendo servidos como eles mesmos);
- `Cache-Control` curto no `sw.js` — é ele quem descobre que existe versão nova do app; cacheado, o celular ficaria preso numa versão velha.

### 2.1 Importar o repositório

Em https://vercel.com/new, importe `devsecfate/App-de-escala`. Deixe o **Root Directory** na raiz do repositório (o `vercel.json` cuida do resto).

O projeto já está criado e ligado ao repositório, com `main` como branch de
produção: **todo push para `main` publica sozinho**. Para publicar sem passar
pelo git (o que sobe o diretório local, não o commit):

```bash
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```

### 2.2 Variáveis de ambiente

Em **Settings → Environment Variables** (marque Production, Preview e Development):

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → a chave **publicável** (`sb_publishable_...`) |
| `VITE_VAPID_PUBLIC_KEY` | a chave pública gerada em 1.5 (opcional) |

O nome da variável diz `ANON_KEY` por herança, mas o valor é a chave
publicável nova. Neste projeto as **chaves legadas (`anon`/`service_role`) estão
desligadas** — ver 1.7.

Sem as duas primeiras o build **falha de propósito**, com mensagem explícita: sem elas o Rollup descartaria o app inteiro e publicaria um bundle vazio, e o deploy "passaria" mostrando uma tela em branco.

> **Cuidado ao gravar esses valores pelo terminal.** No Windows PowerShell 5.1,
> `"valor" | vercel env add NOME` grava um **BOM (U+FEFF) invisível na frente**
> do valor. A chave vai dentro de um cabeçalho HTTP, cabeçalho só aceita
> Latin-1, e o navegador então recusa montar a requisição com
> `Failed to execute 'fetch' ... String contains non ISO-8859-1 code point`.
> O app fica completamente mudo — nenhuma chamada sai, nada aparece no log do
> servidor. Aconteceu neste projeto e custou uma sessão de depuração.
> Use o Bash (`printf '%s' "valor" | vercel env add ...`) ou cole no painel.
> Desde então `apps/web/src/lib/supabase.ts` também remove BOM e espaços das
> variáveis, mas o melhor é não gravar torto.

Sem a terceira, o botão "Avisos no celular" simplesmente não aparece — o resto funciona.

### 2.3 Depois de subir

Volte ao passo 1.3 e coloque a URL da Vercel no Supabase.

---

## 3. Conferir no celular

Abra a URL da Vercel no celular (HTTPS de verdade, que é o que o service worker exige):

1. **Cadastre-se** (nome, e-mail e senha) e passe pelo onboarding: "Sou eu quem administra a igreja" cria a igreja e te deixa admin. Depois gere um código de convite e teste em outro aparelho (ou numa janela anônima) o caminho de quem é convidado.
2. **Instalar:** Android → o cartão "Instalar na tela inicial" ou o menu do Chrome; iPhone → Compartilhar → "Adicionar à Tela de Início". O ícone tem que sair certo, sem fundo branco nem corte.
3. **Abrir pelo atalho:** tem que abrir em tela cheia, sem barra de endereço.
4. **Offline:** navegue pelas telas, ligue o modo avião e **recarregue**. A escala tem que continuar aparecendo, com a faixa âmbar no topo.
5. **Avisos no celular** (se configurou VAPID): ativar, e conferir a linha nova em `push_subscriptions`.
6. **Sair:** o cache `escala-dados-v1` tem que sumir junto.
