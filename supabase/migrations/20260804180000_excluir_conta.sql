-- Excluir a própria conta.
--
-- Segue a mesma regra que vale para ministério, evento e função desde a Etapa
-- 6, porque o problema é idêntico: `escalacoes.perfil_id` é `on delete
-- cascade`, então apagar o perfil de quem serviu por um ano apagaria junto todo
-- o histórico dele — e o relatório de participação da igreja passaria a contar
-- diferente do que contava ontem, sem ninguém entender por quê.
--
--   nunca serviu  → some de vez (perfil, vínculos e login)
--   já serviu     → o login é destruído e o perfil vira inativo; o nome
--                   continua nas escalas passadas, que é o que o relatório lê
--
-- Nos dois casos a pessoa deixa de conseguir entrar. É isso que "excluir a
-- conta" significa; "sair da igreja" seria outra coisa e não é o que está aqui.
--
-- Por que uma função `security definer` e não uma Edge Function: apagar de
-- `auth.users` exige privilégio que o cliente não tem. No Supabase hospedado o
-- papel `postgres` não é superusuário, mas **tem DELETE/UPDATE em auth.users e
-- tem BYPASSRLS** (conferido no projeto de produção antes de escrever isto), e
-- é ele quem passa a ser dono desta função. Uma Edge Function com service_role
-- resolveria também, mas custaria um deploy separado e um segredo a mais.

-- ---------------------------------------------------------------------------
-- Passe de dentro da casa
--
-- Dois triggers protegem o caminho normal do app e atrapalhariam este: o que
-- impede alguém de mexer no próprio `ativo` (senão qualquer um viraria admin) e
-- o que impede o último líder de sair. As checagens desta função são mais
-- específicas e vêm com mensagem melhor, então ela avisa aos triggers que já
-- conferiu. `set_config(..., true)` é local à transação: ninguém de fora
-- enxerga esta marca, e ela some no commit.
-- ---------------------------------------------------------------------------

create or replace function excluindo_a_propria_conta()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.excluindo_conta', true), '') = 'sim';
$$;

grant execute on function excluindo_a_propria_conta() to authenticated;

create or replace function trg_restringe_update_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / postgres (seed, Edge Function) passam direto.
  if auth.uid() is null then
    return new;
  end if;

  if excluindo_a_propria_conta() and new.id = auth.uid() then
    return new;
  end if;

  if e_admin() then
    return new;
  end if;

  if new.papel_global <> old.papel_global
     or new.igreja_id <> old.igreja_id
     or new.id <> old.id
     or new.ativo <> old.ativo then
    raise exception 'Você só pode alterar seu nome, telefone e e-mail.';
  end if;

  return new;
end;
$$;

create or replace function trg_protege_ultimo_lider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ministerio_id uuid;
  v_perfil_id uuid;
  v_restantes int;
begin
  -- `excluir_minha_conta()` já conferiu, com mensagem própria, se a saída
  -- deixaria algum ministério sem líder.
  if excluindo_a_propria_conta() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_ministerio_id := old.ministerio_id;
    v_perfil_id := old.perfil_id;
    if old.papel <> 'lider' or not old.ativo then
      return old;
    end if;
  else
    v_ministerio_id := new.ministerio_id;
    v_perfil_id := new.perfil_id;
    if new.papel = 'lider' and new.ativo then
      return new;
    end if;
    if old.papel <> 'lider' or not old.ativo then
      return new;
    end if;
  end if;

  -- Exclusão em cascade do próprio ministério: o Postgres apaga a linha do
  -- ministério primeiro e só depois dispara o cascade nos filhos, então aqui o
  -- ministério já não existe.
  if not exists (select 1 from ministerios where id = v_ministerio_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select count(*)
    into v_restantes
    from membros_ministerio
   where ministerio_id = v_ministerio_id
     and perfil_id <> v_perfil_id
     and papel = 'lider'
     and ativo;

  if v_restantes = 0 then
    raise exception 'Este é o único líder do ministério. Promova outra pessoa a líder antes de sair.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quanto histórico eu tenho
--
-- A tela precisa deste número ANTES de perguntar, para dizer qual dos dois
-- desfechos vai acontecer — a mesma regra de `decidirExclusao` no core. Conta
-- escalação e escala criada por mim: `escalas.criada_por` não é cascade, então
-- um rascunho meu bastaria para o DELETE falhar com erro de chave estrangeira.
-- ---------------------------------------------------------------------------

create or replace function contar_meu_historico()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from escalacoes where perfil_id = auth.uid())::int
  + (select count(*) from escalas where criada_por = auth.uid())::int;
$$;

grant execute on function contar_meu_historico() to authenticated;

-- ---------------------------------------------------------------------------
-- Excluir a conta
-- ---------------------------------------------------------------------------

create or replace function excluir_minha_conta()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := auth.uid();
  v_igreja_id uuid;
  v_sou_admin boolean;
  v_historico int;
  v_ministerio_preso text;
begin
  if v_id is null then
    raise exception 'Você precisa estar logado para excluir a conta.';
  end if;

  select igreja_id, papel_global = 'admin'
    into v_igreja_id, v_sou_admin
    from perfis
   where id = v_id;

  -- Sem perfil: a pessoa criou a conta e nunca entrou em igreja nenhuma.
  -- Não há histórico possível, então some tudo.
  if not found then
    delete from auth.users where id = v_id;
    return 'excluida';
  end if;

  -- Único administrador de uma igreja que ainda tem gente: sair deixaria a
  -- igreja sem ninguém que possa criar ministério ou promover alguém.
  if v_sou_admin
     and exists (select 1 from perfis where igreja_id = v_igreja_id and id <> v_id and ativo)
     and not exists (
       select 1 from perfis
        where igreja_id = v_igreja_id and id <> v_id and ativo and papel_global = 'admin'
     ) then
    raise exception 'Você é o único administrador da igreja. Promova outra pessoa a administrador antes de excluir sua conta.';
  end if;

  -- Único líder de um ministério que ainda tem outras pessoas. Se eu for a
  -- única pessoa de lá, sair não prende ninguém — o ministério fica vazio e o
  -- administrador repovoa.
  select m.nome
    into v_ministerio_preso
    from membros_ministerio meu
    join ministerios m on m.id = meu.ministerio_id
   where meu.perfil_id = v_id
     and meu.papel = 'lider'
     and meu.ativo
     and exists (
       select 1 from membros_ministerio outro
        where outro.ministerio_id = meu.ministerio_id
          and outro.perfil_id <> v_id
          and outro.ativo
     )
     and not exists (
       select 1 from membros_ministerio outro
        where outro.ministerio_id = meu.ministerio_id
          and outro.perfil_id <> v_id
          and outro.ativo
          and outro.papel = 'lider'
     )
   limit 1;

  if v_ministerio_preso is not null then
    raise exception 'Você é o único líder de %. Promova outra pessoa a líder antes de excluir sua conta.', v_ministerio_preso;
  end if;

  -- Daqui para baixo os triggers de proteção sabem que as checagens já foram
  -- feitas, com mensagens melhores do que as deles.
  perform set_config('app.excluindo_conta', 'sim', true);

  select contar_meu_historico() into v_historico;

  delete from membros_ministerio where perfil_id = v_id;
  delete from indisponibilidades where perfil_id = v_id;
  delete from push_subscriptions where perfil_id = v_id;

  if v_historico = 0 then
    -- Nunca serviu: o cascade de auth.users leva o perfil junto e não sobra
    -- rastro. Se eu era a última pessoa da igreja, a igreja vai junto — tenant
    -- órfão só acumularia ministérios e eventos que ninguém mais alcança.
    delete from auth.users where id = v_id;

    if not exists (select 1 from perfis where igreja_id = v_igreja_id) then
      delete from igrejas where id = v_igreja_id;
    end if;

    return 'excluida';
  end if;

  -- Já serviu: o perfil fica, inativo, só com o nome — é dele que o relatório
  -- precisa para dizer quem serviu em março. Some das listas porque toda
  -- consulta do app filtra por `ativo`.
  update perfis
     set ativo = false,
         telefone = null,
         email = 'conta-removida.' || replace(v_id::text, '-', '') || '@invalido.local'
   where id = v_id;

  -- O login morre: sem e-mail, sem senha e banido. O e-mail volta a ficar livre
  -- caso a pessoa queira criar uma conta nova um dia.
  update auth.users
     set email = null,
         encrypted_password = null,
         phone = null,
         email_change = '',
         raw_user_meta_data = '{}'::jsonb,
         banned_until = 'infinity'::timestamptz
   where id = v_id;

  return 'arquivada';
end;
$$;

grant execute on function excluir_minha_conta() to authenticated;
