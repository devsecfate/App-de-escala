-- Etapa 6.2 — poder corrigir o que foi criado errado.
--
-- Até aqui evento, ministério e função tinham botão de criar e nenhum de editar
-- ou excluir. As policies de UPDATE/DELETE já existiam desde a migration de RLS;
-- o que faltava era (a) a coluna que permite ARQUIVAR em vez de apagar e
-- (b) uma forma honesta de contar o histórico antes de perguntar.
--
-- Por que arquivar: `ministerios` tem 7 chaves estrangeiras em cascade
-- apontando para ele e `escalas` cascateia mais uma camada. Apagar o ministério
-- "Louvor" apagaria as escalas, as escalações e o cronograma de anos — e o
-- relatório de participação mudaria retroativamente, sem ninguém entender por
-- quê. O mesmo vale para `funcoes`: `escalacoes.funcao_id` é cascade, então
-- apagar "Guitarra" apagaria quem serviu em guitarra no ano passado.
--
-- A regra do app: nunca foi usado → exclui de vez; já tem histórico → arquiva.

-- ---------------------------------------------------------------------------
-- Coluna `ativo` onde faltava
--
-- `ministerios.ativo` e `perfis.ativo` já existem desde o schema inicial (e
-- nunca ninguém escreveu neles). `eventos` e `funcoes` não tinham.
-- ---------------------------------------------------------------------------

alter table eventos add column if not exists ativo boolean not null default true;
alter table funcoes add column if not exists ativo boolean not null default true;

-- As listas do app filtram por `ativo` em toda consulta; o índice parcial evita
-- varrer as linhas arquivadas, que só crescem.
create index if not exists eventos_igreja_ativo_idx on eventos (igreja_id, data_hora) where ativo;
create index if not exists funcoes_ministerio_ativo_idx on funcoes (ministerio_id) where ativo;

-- ---------------------------------------------------------------------------
-- envios — faltava a policy de DELETE
--
-- Era a única tabela de negócio sem ela. Com RLS ligada e nenhuma policy de
-- DELETE, o PostgREST devolve 200 com zero linhas afetadas: o app acha que
-- apagou e o registro continua lá. Falha silenciosa é pior que erro.
-- ---------------------------------------------------------------------------

create policy envios_delete on envios
  for delete using (
    exists (select 1 from escalas e where e.id = escala_id and e_lider(e.ministerio_id))
  );

-- ---------------------------------------------------------------------------
-- Contagem de histórico (arquivar ou excluir?)
--
-- Precisa ser `security definer` por um motivo concreto: `escalacoes_select`
-- só deixa a pessoa ver as escalações dos ministérios que ela lidera (ou as
-- publicadas). Se o app contasse pelo cliente, o admin que abre um evento usado
-- pelo ministério de Louvor — que ele não lidera — leria zero, o app diria
-- "nunca foi usado" e o DELETE em cascade levaria junto a escala do Louvor.
--
-- Contar no servidor com a visão completa é o que impede esse acidente. O
-- número em si não vaza nada: é só uma quantidade, e o acesso continua preso à
-- própria igreja.
-- ---------------------------------------------------------------------------

create or replace function contar_escalacoes_do_evento(p_evento_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from escalacoes es
  join escalas e on e.id = es.escala_id
  join eventos ev on ev.id = e.evento_id
  where e.evento_id = p_evento_id
    and ev.igreja_id = minha_igreja();
$$;

create or replace function contar_escalacoes_do_ministerio(p_ministerio_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from escalacoes es
  join escalas e on e.id = es.escala_id
  join ministerios m on m.id = e.ministerio_id
  where e.ministerio_id = p_ministerio_id
    and m.igreja_id = minha_igreja();
$$;

create or replace function contar_escalacoes_da_funcao(p_funcao_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from escalacoes es
  join funcoes f on f.id = es.funcao_id
  join ministerios m on m.id = f.ministerio_id
  where es.funcao_id = p_funcao_id
    and m.igreja_id = minha_igreja();
$$;

-- Música só entra em escala pelo cronograma; `cronograma_itens.musica_id` é
-- `on delete restrict`, então o banco já impede o acidente. A contagem existe
-- para a tela poder explicar antes, em vez de deixar o erro do Postgres chegar
-- cru na cara do líder.
create or replace function contar_usos_da_musica(p_musica_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from cronograma_itens ci
  join musicas mu on mu.id = ci.musica_id
  join ministerios m on m.id = mu.ministerio_id
  where ci.musica_id = p_musica_id
    and m.igreja_id = minha_igreja();
$$;

-- ---------------------------------------------------------------------------
-- Último líder do ministério
--
-- O "Remover" da tela de membros deixava o líder remover a si mesmo e o
-- ministério ficava sem ninguém que pudesse montar escala — e sem ninguém que
-- pudesse se readicionar, porque `membros_ministerio_insert` exige e_lider().
-- Só um admin da igreja conseguiria desfazer. O trigger fecha isso no banco,
-- que é onde vale para qualquer caminho (tela, script, API).
-- ---------------------------------------------------------------------------

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
  if tg_op = 'DELETE' then
    v_ministerio_id := old.ministerio_id;
    v_perfil_id := old.perfil_id;
    if old.papel <> 'lider' or not old.ativo then
      return old;
    end if;
  else
    v_ministerio_id := new.ministerio_id;
    v_perfil_id := new.perfil_id;
    -- Continua líder ativo: nada a proteger.
    if new.papel = 'lider' and new.ativo then
      return new;
    end if;
    if old.papel <> 'lider' or not old.ativo then
      return new;
    end if;
  end if;

  -- Exclusão em cascade do próprio ministério: o Postgres apaga a linha do
  -- ministério primeiro e só depois dispara o cascade nos filhos, então aqui o
  -- ministério já não existe. Sem esta saída, excluir um ministério que nunca
  -- foi usado (o caminho que a Etapa 6 abriu) morreria reclamando de líder.
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

create trigger membros_ministerio_protege_ultimo_lider
  before update or delete on membros_ministerio
  for each row execute function trg_protege_ultimo_lider();

-- ---------------------------------------------------------------------------
-- Grants
--
-- Repetidos porque o projeto não usa `alter default privileges` (ver o
-- cabeçalho de 20260801233000_grants_authenticated.sql). Aqui não nasceu tabela
-- nova, mas as funções precisam de execute.
-- ---------------------------------------------------------------------------

grant execute on function contar_escalacoes_do_evento(uuid) to authenticated;
grant execute on function contar_escalacoes_do_ministerio(uuid) to authenticated;
grant execute on function contar_escalacoes_da_funcao(uuid) to authenticated;
grant execute on function contar_usos_da_musica(uuid) to authenticated;
