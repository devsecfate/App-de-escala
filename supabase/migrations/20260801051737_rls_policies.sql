-- Row Level Security do App de Escala.
-- Implementa no banco as regras de regras/regras.md e planejamento/arquitetura.md:
-- cada líder só pode montar/editar a escala do ministério que lidera; pessoa só
-- confirma a própria escalação; tudo isolado por igreja (multi-tenant).

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer para evitar recursão de RLS ao
-- consultar perfis/membros_ministerio de dentro de outras policies).
-- ---------------------------------------------------------------------------

create or replace function minha_igreja()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select igreja_id from perfis where id = auth.uid();
$$;

create or replace function e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select papel_global = 'admin' from perfis where id = auth.uid()),
    false
  );
$$;

create or replace function e_lider(p_ministerio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from membros_ministerio
    where ministerio_id = p_ministerio_id
      and perfil_id = auth.uid()
      and papel = 'lider'
      and ativo
  ) or e_admin();
$$;

create or replace function pertence_ministerio(p_ministerio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from membros_ministerio
    where ministerio_id = p_ministerio_id
      and perfil_id = auth.uid()
      and ativo
  );
$$;

create or replace function sou_lider_de_algum_ministerio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from membros_ministerio mm
    join ministerios m on m.id = mm.ministerio_id
    where mm.perfil_id = auth.uid()
      and mm.papel = 'lider'
      and mm.ativo
      and m.igreja_id = minha_igreja()
  ) or e_admin();
$$;

grant execute on function minha_igreja() to authenticated;
grant execute on function e_admin() to authenticated;
grant execute on function e_lider(uuid) to authenticated;
grant execute on function pertence_ministerio(uuid) to authenticated;
grant execute on function sou_lider_de_algum_ministerio() to authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding: criar igreja + perfil admin numa transação só.
-- Convite de novos membros (vincular perfil_id a uma igreja existente) fica
-- para a Fase 1, quando a tela de convite for implementada.
-- ---------------------------------------------------------------------------

create or replace function criar_igreja(p_nome text, p_fuso_horario text default 'America/Sao_Paulo')
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
    coalesce(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Administrador'),
    auth.jwt() ->> 'email',
    'admin'
  );

  return v_igreja_id;
end;
$$;

grant execute on function criar_igreja(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ativar RLS em todas as tabelas de negócio
-- ---------------------------------------------------------------------------

alter table igrejas enable row level security;
alter table perfis enable row level security;
alter table ministerios enable row level security;
alter table membros_ministerio enable row level security;
alter table funcoes enable row level security;
alter table membro_funcoes enable row level security;
alter table eventos enable row level security;
alter table escalas enable row level security;
alter table escalacoes enable row level security;
alter table indisponibilidades enable row level security;
alter table regras_ministerio enable row level security;
alter table categorias_musica enable row level security;
alter table musicas enable row level security;
alter table cronograma_itens enable row level security;
alter table envios enable row level security;

-- ---------------------------------------------------------------------------
-- igrejas — leitura da própria igreja; escrita (dados da igreja) por admin.
-- Criação só via criar_igreja().
-- ---------------------------------------------------------------------------

create policy igrejas_select on igrejas
  for select using (id = minha_igreja());

create policy igrejas_update on igrejas
  for update using (id = minha_igreja() and e_admin())
  with check (id = minha_igreja() and e_admin());

-- ---------------------------------------------------------------------------
-- perfis — qualquer membro da igreja vê os colegas; cada um edita o próprio
-- perfil; admin edita qualquer perfil da igreja. Inserção só via RPC.
-- ---------------------------------------------------------------------------

create policy perfis_select on perfis
  for select using (igreja_id = minha_igreja());

create policy perfis_update_propria on perfis
  for update using (id = auth.uid())
  with check (id = auth.uid() and igreja_id = minha_igreja());

create policy perfis_update_admin on perfis
  for update using (igreja_id = minha_igreja() and e_admin())
  with check (igreja_id = minha_igreja() and e_admin());

-- ---------------------------------------------------------------------------
-- ministerios — leitura para a igreja toda; escrita só para admin.
-- ---------------------------------------------------------------------------

create policy ministerios_select on ministerios
  for select using (igreja_id = minha_igreja());

create policy ministerios_insert on ministerios
  for insert with check (igreja_id = minha_igreja() and e_admin());

create policy ministerios_update on ministerios
  for update using (igreja_id = minha_igreja() and e_admin())
  with check (igreja_id = minha_igreja() and e_admin());

create policy ministerios_delete on ministerios
  for delete using (igreja_id = minha_igreja() and e_admin());

-- ---------------------------------------------------------------------------
-- membros_ministerio — leitura para a igreja; escrita para admin ou líder
-- do próprio ministério.
-- ---------------------------------------------------------------------------

create policy membros_ministerio_select on membros_ministerio
  for select using (
    exists (select 1 from ministerios m where m.id = ministerio_id and m.igreja_id = minha_igreja())
  );

create policy membros_ministerio_insert on membros_ministerio
  for insert with check (e_lider(ministerio_id));

create policy membros_ministerio_update on membros_ministerio
  for update using (e_lider(ministerio_id)) with check (e_lider(ministerio_id));

create policy membros_ministerio_delete on membros_ministerio
  for delete using (e_lider(ministerio_id));

-- ---------------------------------------------------------------------------
-- funcoes — leitura para a igreja; escrita para admin ou líder do ministério.
-- ---------------------------------------------------------------------------

create policy funcoes_select on funcoes
  for select using (
    exists (select 1 from ministerios m where m.id = ministerio_id and m.igreja_id = minha_igreja())
  );

create policy funcoes_insert on funcoes
  for insert with check (e_lider(ministerio_id));

create policy funcoes_update on funcoes
  for update using (e_lider(ministerio_id)) with check (e_lider(ministerio_id));

create policy funcoes_delete on funcoes
  for delete using (e_lider(ministerio_id));

-- ---------------------------------------------------------------------------
-- membro_funcoes — segue a permissão do ministério da função.
-- ---------------------------------------------------------------------------

create policy membro_funcoes_select on membro_funcoes
  for select using (
    exists (
      select 1 from funcoes f
      join ministerios m on m.id = f.ministerio_id
      where f.id = funcao_id and m.igreja_id = minha_igreja()
    )
  );

create policy membro_funcoes_insert on membro_funcoes
  for insert with check (
    exists (select 1 from funcoes f where f.id = funcao_id and e_lider(f.ministerio_id))
  );

create policy membro_funcoes_delete on membro_funcoes
  for delete using (
    exists (select 1 from funcoes f where f.id = funcao_id and e_lider(f.ministerio_id))
  );

-- ---------------------------------------------------------------------------
-- eventos — leitura para a igreja toda; escrita para admin ou qualquer líder;
-- exclusão só para admin (evita apagar evento com escalas de outro ministério).
-- ---------------------------------------------------------------------------

create policy eventos_select on eventos
  for select using (igreja_id = minha_igreja());

create policy eventos_insert on eventos
  for insert with check (igreja_id = minha_igreja() and sou_lider_de_algum_ministerio());

create policy eventos_update on eventos
  for update using (igreja_id = minha_igreja() and sou_lider_de_algum_ministerio())
  with check (igreja_id = minha_igreja() and sou_lider_de_algum_ministerio());

create policy eventos_delete on eventos
  for delete using (igreja_id = minha_igreja() and e_admin());

-- ---------------------------------------------------------------------------
-- escalas — escrita só para o líder do ministério. Leitura: líder sempre;
-- os demais membros da igreja só quando a escala está publicada.
-- ---------------------------------------------------------------------------

create policy escalas_select on escalas
  for select using (
    e_lider(ministerio_id)
    or (
      status = 'publicada'
      and exists (select 1 from ministerios m where m.id = ministerio_id and m.igreja_id = minha_igreja())
    )
  );

create policy escalas_insert on escalas
  for insert with check (e_lider(ministerio_id));

create policy escalas_update on escalas
  for update using (e_lider(ministerio_id)) with check (e_lider(ministerio_id));

create policy escalas_delete on escalas
  for delete using (e_lider(ministerio_id));

-- ---------------------------------------------------------------------------
-- escalacoes — líder faz tudo na escala que lidera; a própria pessoa só pode
-- atualizar a confirmação da própria linha (reforçado por trigger abaixo,
-- já que RLS filtra linhas, não colunas).
-- ---------------------------------------------------------------------------

create policy escalacoes_select on escalacoes
  for select using (
    perfil_id = auth.uid()
    or exists (
      select 1 from escalas e
      where e.id = escala_id
        and (
          e_lider(e.ministerio_id)
          or (
            e.status = 'publicada'
            and exists (select 1 from ministerios m where m.id = e.ministerio_id and m.igreja_id = minha_igreja())
          )
        )
    )
  );

create policy escalacoes_insert on escalacoes
  for insert with check (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

create policy escalacoes_update on escalacoes
  for update using (
    perfil_id = auth.uid()
    or exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  )
  with check (
    perfil_id = auth.uid()
    or exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

create policy escalacoes_delete on escalacoes
  for delete using (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

create or replace function trg_restringe_update_escalacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ministerio_id uuid;
begin
  select ministerio_id into v_ministerio_id from escalas where id = new.escala_id;

  if e_lider(v_ministerio_id) then
    return new;
  end if;

  if old.perfil_id <> auth.uid() then
    raise exception 'Sem permissão para alterar esta escalação.';
  end if;

  if new.escala_id <> old.escala_id
     or new.perfil_id <> old.perfil_id
     or new.funcao_id <> old.funcao_id then
    raise exception 'Você só pode alterar a confirmação da sua própria escalação.';
  end if;

  return new;
end;
$$;

create trigger escalacoes_restringe_update
  before update on escalacoes
  for each row execute function trg_restringe_update_escalacao();

-- ---------------------------------------------------------------------------
-- indisponibilidades — a pessoa gerencia a própria; o líder de um ministério
-- ao qual ela pertence pode ler (para montar a escala vendo quem não pode).
-- ---------------------------------------------------------------------------

create policy indisponibilidades_select on indisponibilidades
  for select using (
    perfil_id = auth.uid()
    or exists (
      select 1 from membros_ministerio mm
      where mm.perfil_id = indisponibilidades.perfil_id
        and mm.ativo
        and e_lider(mm.ministerio_id)
    )
  );

create policy indisponibilidades_insert on indisponibilidades
  for insert with check (perfil_id = auth.uid());

create policy indisponibilidades_update on indisponibilidades
  for update using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy indisponibilidades_delete on indisponibilidades
  for delete using (perfil_id = auth.uid());

-- ---------------------------------------------------------------------------
-- regras_ministerio — leitura para a igreja; escrita para admin ou líder.
-- ---------------------------------------------------------------------------

create policy regras_ministerio_select on regras_ministerio
  for select using (
    exists (select 1 from ministerios m where m.id = ministerio_id and m.igreja_id = minha_igreja())
  );

create policy regras_ministerio_insert on regras_ministerio
  for insert with check (e_lider(ministerio_id));

create policy regras_ministerio_update on regras_ministerio
  for update using (e_lider(ministerio_id)) with check (e_lider(ministerio_id));

create policy regras_ministerio_delete on regras_ministerio
  for delete using (e_lider(ministerio_id));

-- ---------------------------------------------------------------------------
-- categorias_musica / musicas — repertório é do líder do ministério de
-- louvor (ou qualquer ministério que use repertório); leitura para a igreja.
-- ---------------------------------------------------------------------------

create policy categorias_musica_select on categorias_musica
  for select using (
    exists (select 1 from ministerios m where m.id = ministerio_id and m.igreja_id = minha_igreja())
  );

create policy categorias_musica_insert on categorias_musica
  for insert with check (e_lider(ministerio_id));

create policy categorias_musica_update on categorias_musica
  for update using (e_lider(ministerio_id)) with check (e_lider(ministerio_id));

create policy categorias_musica_delete on categorias_musica
  for delete using (e_lider(ministerio_id));

create policy musicas_select on musicas
  for select using (
    exists (select 1 from ministerios m where m.id = ministerio_id and m.igreja_id = minha_igreja())
  );

create policy musicas_insert on musicas
  for insert with check (e_lider(ministerio_id));

create policy musicas_update on musicas
  for update using (e_lider(ministerio_id)) with check (e_lider(ministerio_id));

create policy musicas_delete on musicas
  for delete using (e_lider(ministerio_id));

-- ---------------------------------------------------------------------------
-- cronograma_itens — segue a permissão da escala (via ministério).
-- ---------------------------------------------------------------------------

create policy cronograma_itens_select on cronograma_itens
  for select using (
    exists (
      select 1 from escalas e
      where e.id = escala_id
        and (
          e_lider(e.ministerio_id)
          or (
            e.status = 'publicada'
            and exists (select 1 from ministerios m where m.id = e.ministerio_id and m.igreja_id = minha_igreja())
          )
        )
    )
  );

create policy cronograma_itens_insert on cronograma_itens
  for insert with check (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

create policy cronograma_itens_update on cronograma_itens
  for update using (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  )
  with check (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

create policy cronograma_itens_delete on cronograma_itens
  for delete using (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

-- ---------------------------------------------------------------------------
-- envios — só o líder do ministério da escala (ou admin) vê/gera envios.
-- ---------------------------------------------------------------------------

create policy envios_select on envios
  for select using (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

create policy envios_insert on envios
  for insert with check (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

create policy envios_update on envios
  for update using (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  )
  with check (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );
