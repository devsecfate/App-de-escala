-- Colunas configuráveis do repertório (Fase 4).
--
-- `musicas.extras jsonb` (Fase 0) guarda os VALORES dos campos que o líder
-- inventa (BPM, quem canta, instrumento principal...), mas não havia onde
-- guardar QUAIS campos existem nem em que ordem aparecem. É o que esta tabela
-- resolve, atendendo repertorio/louvores.md: "o líder pode adicionar, editar,
-- reordenar ou remover colunas conforme a necessidade".

create table campos_musica (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references ministerios (id) on delete cascade,
  -- chave usada dentro de musicas.extras
  chave text not null,
  -- rótulo que o líder vê na tela
  rotulo text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (ministerio_id, chave)
);

create index campos_musica_ministerio_id_idx on campos_musica (ministerio_id);

alter table campos_musica enable row level security;

-- Mesma regra de categorias_musica: a igreja lê, o líder do ministério escreve.
create policy campos_musica_select on campos_musica
  for select using (
    exists (select 1 from ministerios m where m.id = ministerio_id and m.igreja_id = minha_igreja())
  );

create policy campos_musica_insert on campos_musica
  for insert with check (e_lider(ministerio_id));

create policy campos_musica_update on campos_musica
  for update using (e_lider(ministerio_id)) with check (e_lider(ministerio_id));

create policy campos_musica_delete on campos_musica
  for delete using (e_lider(ministerio_id));
