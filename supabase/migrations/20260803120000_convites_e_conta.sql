-- Etapa 6.1 — Conta própria e entrada na igreja por código de convite.
--
-- Até aqui não existia jeito de entrar numa igreja: `criar_igreja` só servia
-- para quem administra, e o convite por e-mail dependia de SMTP que este
-- projeto não tem. Agora o líder gera um código, manda por onde quiser
-- (WhatsApp, papel, voz), e quem digitar o código entra direto no ministério.
--
-- Nada aqui depende de e-mail.

-- ---------------------------------------------------------------------------
-- Tabela de convites
-- ---------------------------------------------------------------------------

create table convites (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igrejas (id) on delete cascade,
  -- null = entra só na igreja (o admin depois coloca no ministério).
  ministerio_id uuid references ministerios (id) on delete cascade,
  codigo text not null unique,
  nome_sugerido text,
  papel text not null default 'membro' check (papel in ('lider', 'membro')),
  usos_max int not null default 1 check (usos_max between 1 and 100),
  usos int not null default 0 check (usos >= 0),
  expira_em timestamptz not null,
  cancelado_em timestamptz,
  criado_por uuid references perfis (id) on delete set null,
  created_at timestamptz not null default now()
);

create index convites_igreja_id_idx on convites (igreja_id);
create index convites_ministerio_id_idx on convites (ministerio_id);

-- ---------------------------------------------------------------------------
-- Geração do código
-- ---------------------------------------------------------------------------

-- Alfabeto sem O/0, I/1 e L: são os pares que a pessoa lê errado ao digitar um
-- código que chegou por foto ou ditado. 31^8 ≈ 8,5 x 10^11 combinações, e o
-- convite ainda tem validade e limite de usos.
--
-- `gen_random_bytes` (pgcrypto, já instalado no schema inicial) em vez de
-- `random()`: o gerador do Postgres é previsível dentro da sessão, e adivinhar
-- código de convite é entrar na igreja de outra pessoa.
-- `extensions` no search_path porque é lá que o Supabase instala o pgcrypto: com
-- `search_path = public` sozinho, `gen_random_bytes` some ("function does not
-- exist"). O `gen_random_uuid` das outras tabelas engana, porque esse é embutido
-- no Postgres desde a versão 13 e não vem do pgcrypto.
create or replace function gerar_codigo_convite()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_tamanho constant int := length(v_alfabeto);
  v_codigo text;
  v_bytes bytea;
  v_tentativa int := 0;
begin
  loop
    v_codigo := '';
    v_bytes := gen_random_bytes(8);
    for i in 0..7 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + (get_byte(v_bytes, i) % v_tamanho), 1);
    end loop;

    exit when not exists (select 1 from convites where codigo = v_codigo);

    v_tentativa := v_tentativa + 1;
    if v_tentativa >= 20 then
      raise exception 'Não foi possível gerar um código de convite. Tente de novo.';
    end if;
  end loop;

  return v_codigo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Criar convite (líder do ministério, ou admin da igreja)
-- ---------------------------------------------------------------------------

-- `igreja_id` e `criado_por` são preenchidos aqui dentro, nunca vêm do cliente:
-- se viessem, daria para forjar convite para a igreja de outra pessoa.
create or replace function criar_convite(
  p_ministerio_id uuid default null,
  p_papel text default 'membro',
  p_nome_sugerido text default null,
  p_usos_max int default 1,
  p_valido_por_dias int default 7
)
returns convites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja_id uuid;
  v_convite convites;
begin
  v_igreja_id := minha_igreja();
  if v_igreja_id is null then
    raise exception 'Você precisa fazer parte de uma igreja para gerar convites.';
  end if;

  if p_papel not in ('lider', 'membro') then
    raise exception 'Papel inválido: use lider ou membro.';
  end if;

  if p_usos_max is null or p_usos_max < 1 or p_usos_max > 100 then
    raise exception 'O limite de usos precisa ficar entre 1 e 100.';
  end if;

  if p_valido_por_dias is null or p_valido_por_dias < 1 or p_valido_por_dias > 90 then
    raise exception 'A validade precisa ficar entre 1 e 90 dias.';
  end if;

  if p_ministerio_id is null then
    -- Convite só para a igreja: quem decide quem entra sem ministério é o admin.
    if not e_admin() then
      raise exception 'Só quem administra a igreja pode gerar convite sem ministério.';
    end if;
  else
    if not exists (
      select 1 from ministerios
      where id = p_ministerio_id and igreja_id = v_igreja_id
    ) then
      raise exception 'Ministério não encontrado nesta igreja.';
    end if;

    if not e_lider(p_ministerio_id) then
      raise exception 'Só o líder deste ministério pode gerar convites para ele.';
    end if;
  end if;

  insert into convites (
    igreja_id, ministerio_id, codigo, nome_sugerido, papel, usos_max, expira_em, criado_por
  )
  values (
    v_igreja_id,
    p_ministerio_id,
    gerar_codigo_convite(),
    nullif(btrim(coalesce(p_nome_sugerido, '')), ''),
    p_papel,
    p_usos_max,
    now() + make_interval(days => p_valido_por_dias),
    auth.uid()
  )
  returning * into v_convite;

  return v_convite;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usar convite (quem acabou de criar a conta)
-- ---------------------------------------------------------------------------

-- As mensagens de erro são distintas de propósito: "não existe", "cancelado",
-- "venceu" e "esgotado" pedem reações diferentes de quem está com o celular na
-- mão, e um "convite inválido" genérico faria a pessoa digitar de novo à toa.
create or replace function usar_convite(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_convite convites;
  v_email text;
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta antes de usar o convite.';
  end if;

  if exists (select 1 from perfis where id = auth.uid()) then
    raise exception 'Você já faz parte de uma igreja neste app.';
  end if;

  -- Normaliza o que a pessoa digitou: minúsculas, hífen do formato XXXX-XXXX,
  -- espaço colado no fim do texto copiado do WhatsApp.
  v_codigo := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));

  select * into v_convite from convites where codigo = v_codigo for update;

  if not found then
    raise exception 'Código não encontrado. Confira as letras e tente de novo.';
  end if;

  if v_convite.cancelado_em is not null then
    raise exception 'Este convite foi cancelado. Peça um novo ao líder.';
  end if;

  if v_convite.expira_em <= now() then
    raise exception 'Este convite venceu. Peça um novo ao líder.';
  end if;

  if v_convite.usos >= v_convite.usos_max then
    raise exception 'Este convite já foi usado o número de vezes permitido. Peça um novo ao líder.';
  end if;

  v_email := auth.jwt() ->> 'email';
  v_nome := coalesce(
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'nome'), ''),
    nullif(btrim(v_convite.nome_sugerido), ''),
    nullif(btrim(v_email), ''),
    'Sem nome'
  );

  insert into perfis (id, igreja_id, nome, email, papel_global)
  values (auth.uid(), v_convite.igreja_id, v_nome, coalesce(v_email, ''), 'membro');

  if v_convite.ministerio_id is not null then
    -- `on conflict` porque a constraint única (ministerio_id, perfil_id) já
    -- existe desde o schema inicial: reentrar num ministério reativa o vínculo
    -- em vez de estourar.
    insert into membros_ministerio (ministerio_id, perfil_id, papel)
    values (v_convite.ministerio_id, auth.uid(), v_convite.papel)
    on conflict (ministerio_id, perfil_id)
      do update set ativo = true, papel = excluded.papel;
  end if;

  update convites set usos = usos + 1 where id = v_convite.id;

  return v_convite.igreja_id;
end;
$$;

grant execute on function gerar_codigo_convite() to authenticated;
grant execute on function criar_convite(uuid, text, text, int, int) to authenticated;
grant execute on function usar_convite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Correção 1 — criar_igreja lia o nome no lugar errado
-- ---------------------------------------------------------------------------

-- `auth.jwt() ->> 'name'` nunca existe: o Supabase guarda o que o app mandou
-- no signUp dentro de `user_metadata`. O coalesce caía sempre no e-mail, e
-- TODO administrador nascia com `nome = e-mail`.
--
-- Aproveitando, a função passa a aceitar o nome da pessoa: quem chegou por
-- link mágico (sem signUp) não tem nada em `user_metadata`, e o onboarding
-- agora pergunta. `drop` antes do `create` porque acrescentar parâmetro muda a
-- assinatura — `create or replace` criaria uma segunda função ambígua.
drop function if exists criar_igreja(text, text);

create function criar_igreja(
  p_nome text,
  p_fuso_horario text default 'America/Sao_Paulo',
  p_nome_responsavel text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja_id uuid;
begin
  if exists (select 1 from perfis where id = auth.uid()) then
    raise exception 'Este usuário já possui um perfil.';
  end if;

  insert into igrejas (nome, fuso_horario) values (p_nome, p_fuso_horario)
  returning id into v_igreja_id;

  insert into perfis (id, igreja_id, nome, email, papel_global)
  values (
    auth.uid(),
    v_igreja_id,
    coalesce(
      nullif(btrim(coalesce(p_nome_responsavel, '')), ''),
      nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'nome'), ''),
      nullif(btrim(auth.jwt() ->> 'email'), ''),
      'Administrador'
    ),
    coalesce(auth.jwt() ->> 'email', ''),
    'admin'
  );

  return v_igreja_id;
end;
$$;

grant execute on function criar_igreja(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Correção 2 — qualquer pessoa podia virar admin da própria igreja
-- ---------------------------------------------------------------------------

-- A policy `perfis_update_propria` libera UPDATE na própria linha, e RLS filtra
-- LINHA, não COLUNA: bastava um PATCH em /rest/v1/perfis?id=eq.<meu-id> com
-- {"papel_global":"admin"} para assumir a igreja inteira.
--
-- A defesa é a mesma já usada em escalacoes (trigger `escalacoes_restringe_update`,
-- criado exatamente por este motivo): a policy diz quais linhas, o trigger diz
-- quais colunas.
create or replace function trg_restringe_update_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem usuário no JWT quem está escrevendo é `service_role`, `postgres` ou uma
  -- migration — papéis que já ignoram RLS por definição, e que precisam poder
  -- corrigir dados à mão pelo SQL Editor. (`anon` também cai aqui, mas não tem
  -- grant de UPDATE em perfis: ver 20260801233000_grants_authenticated.sql.)
  if auth.uid() is null then
    return new;
  end if;

  -- Admin da igreja administra os perfis dela (promover, desativar), mas nem
  -- ele muda alguém de igreja.
  if e_admin() then
    if new.igreja_id <> old.igreja_id then
      raise exception 'Não é possível mover um perfil para outra igreja.';
    end if;
    return new;
  end if;

  if new.id <> old.id
     or new.igreja_id <> old.igreja_id
     or new.papel_global <> old.papel_global
     or new.ativo <> old.ativo then
    raise exception 'Você só pode alterar seu nome, telefone e e-mail.';
  end if;

  return new;
end;
$$;

create trigger perfis_restringe_update
  before update on perfis
  for each row execute function trg_restringe_update_perfil();

-- ---------------------------------------------------------------------------
-- RLS de convites
-- ---------------------------------------------------------------------------

-- Quem ainda não tem perfil (o convidado) não enxerga convite nenhum:
-- minha_igreja() é null para ele e nenhuma linha casa. Ele nunca lê a tabela —
-- entra por usar_convite(), que é security definer.
alter table convites enable row level security;

create policy convites_select on convites
  for select using (
    igreja_id = minha_igreja()
    and (
      e_admin()
      or (ministerio_id is not null and e_lider(ministerio_id))
      or criado_por = auth.uid()
    )
  );

-- INSERT direto na tabela fica de fora de propósito: o caminho é criar_convite(),
-- que é quem garante igreja_id, criado_por e o código gerado no servidor.

create policy convites_update on convites
  for update using (
    igreja_id = minha_igreja()
    and (e_admin() or (ministerio_id is not null and e_lider(ministerio_id)))
  )
  with check (
    igreja_id = minha_igreja()
    and (e_admin() or (ministerio_id is not null and e_lider(ministerio_id)))
  );

create policy convites_delete on convites
  for delete using (
    igreja_id = minha_igreja()
    and (e_admin() or (ministerio_id is not null and e_lider(ministerio_id)))
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Repetidos porque o projeto não usa `alter default privileges` (ver o
-- cabeçalho de 20260801233000_grants_authenticated.sql). Sem isto a tabela
-- responde "permission denied for table convites" mesmo com a RLS certa — já
-- derrubou o app inteiro uma vez neste projeto.
grant select, insert, update, delete on table convites to authenticated;
grant select, insert, update, delete on table convites to service_role;
