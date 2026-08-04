-- Promover alguém a administrador da igreja.
--
-- A permissão já existia desde a migration de RLS (`perfis_update_admin`, mais
-- o trigger que impede a auto-promoção), mas não havia nenhuma tela — e nenhum
-- caminho. O buraco ficou evidente na exclusão de conta: a mensagem de erro
-- manda "promova outra pessoa a administrador antes de excluir sua conta", e
-- não havia como fazer isso pelo app.
--
-- O que falta aqui é só a rede de proteção do outro lado: uma igreja sem
-- administrador nenhum é uma igreja onde ninguém mais cria ministério, gera
-- convite de líder, nem promove alguém — e sem administrador não existe quem
-- conserte. É um beco sem saída que só o suporte desfaz.

create or replace function trg_exige_um_administrador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sobra_admin boolean;
begin
  -- Deixava de ser administrador ativo?
  if old.papel_global <> 'admin' or not old.ativo then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.papel_global = 'admin' and new.ativo then
    return new;
  end if;

  -- `excluir_minha_conta()` já decidiu, com mensagem própria, se a saída deixa
  -- a igreja órfã — e o caso em que ela permite é justamente aquele em que não
  -- sobra mais ninguém para administrar.
  if excluindo_a_propria_conta() then
    return coalesce(new, old);
  end if;

  -- Cascade da exclusão da própria igreja: o pai já sumiu, não há o que salvar.
  if not exists (select 1 from igrejas where id = old.igreja_id) then
    return coalesce(new, old);
  end if;

  select exists (
    select 1 from perfis
     where igreja_id = old.igreja_id
       and id <> old.id
       and ativo
       and papel_global = 'admin'
  ) into v_sobra_admin;

  if not v_sobra_admin then
    raise exception 'A igreja precisa de pelo menos um administrador. Promova outra pessoa antes.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger perfis_exige_um_administrador
  before update or delete on perfis
  for each row execute function trg_exige_um_administrador();

-- ---------------------------------------------------------------------------
-- As pessoas da igreja, com os ministérios de cada uma
--
-- A tela nova precisa de perfil + vínculos numa consulta só. Dava para fazer
-- com embed do PostgREST, mas a `membros_ministerio_select` filtra por igreja
-- via `ministerios`, então quem não está em ministério nenhum voltaria sem
-- nenhuma linha e a tela teria que adivinhar a diferença entre "não tem
-- ministério" e "não pude ver". Aqui a resposta é explícita.
-- ---------------------------------------------------------------------------

create or replace function pessoas_da_igreja()
returns table (
  id uuid,
  nome text,
  email text,
  telefone text,
  papel_global text,
  ativo boolean,
  ministerios jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nome,
    p.email,
    p.telefone,
    p.papel_global,
    p.ativo,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'vinculoId', mm.id,
                   'ministerioId', m.id,
                   'ministerioNome', m.nome,
                   'papel', mm.papel
                 )
                 order by m.ordem, m.nome
               )
          from membros_ministerio mm
          join ministerios m on m.id = mm.ministerio_id
         where mm.perfil_id = p.id
           and mm.ativo
           and m.ativo
      ),
      '[]'::jsonb
    ) as ministerios
  from perfis p
  where p.igreja_id = minha_igreja()
  order by p.ativo desc, p.nome;
$$;

grant execute on function pessoas_da_igreja() to authenticated;
