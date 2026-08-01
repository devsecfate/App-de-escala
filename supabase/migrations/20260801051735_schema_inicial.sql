-- Schema inicial do App de Escala.
-- Espelha o modelo de dados descrito em planejamento/arquitetura.md.
-- Multi-tenant por igreja: toda tabela de negócio carrega (direta ou
-- indiretamente) igreja_id, usado pelas policies de RLS na migration seguinte.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Igrejas e perfis
-- ---------------------------------------------------------------------------

create table igrejas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  fuso_horario text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

-- Um perfil por usuário autenticado (auth.users), 1:1.
create table perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  igreja_id uuid not null references igrejas (id) on delete cascade,
  nome text not null,
  telefone text,
  email text not null,
  papel_global text not null default 'membro' check (papel_global in ('admin', 'membro')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index perfis_igreja_id_idx on perfis (igreja_id);

-- ---------------------------------------------------------------------------
-- Ministérios, membros e funções
-- ---------------------------------------------------------------------------

create table ministerios (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igrejas (id) on delete cascade,
  nome text not null,
  descricao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index ministerios_igreja_id_idx on ministerios (igreja_id);

create table membros_ministerio (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references ministerios (id) on delete cascade,
  perfil_id uuid not null references perfis (id) on delete cascade,
  papel text not null default 'membro' check (papel in ('lider', 'membro')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ministerio_id, perfil_id)
);

create index membros_ministerio_ministerio_id_idx on membros_ministerio (ministerio_id);
create index membros_ministerio_perfil_id_idx on membros_ministerio (perfil_id);

create table funcoes (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references ministerios (id) on delete cascade,
  nome text not null,
  obrigatoria boolean not null default false,
  created_at timestamptz not null default now()
);

create index funcoes_ministerio_id_idx on funcoes (ministerio_id);

create table membro_funcoes (
  membro_ministerio_id uuid not null references membros_ministerio (id) on delete cascade,
  funcao_id uuid not null references funcoes (id) on delete cascade,
  primary key (membro_ministerio_id, funcao_id)
);

-- ---------------------------------------------------------------------------
-- Eventos, escalas e escalações
-- ---------------------------------------------------------------------------

create table eventos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igrejas (id) on delete cascade,
  titulo text not null,
  data_hora timestamptz not null,
  tipo text not null default 'culto',
  observacoes text,
  created_at timestamptz not null default now()
);

create index eventos_igreja_id_idx on eventos (igreja_id);
create index eventos_data_hora_idx on eventos (data_hora);

create table escalas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  ministerio_id uuid not null references ministerios (id) on delete cascade,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicada')),
  publicada_em timestamptz,
  criada_por uuid not null references perfis (id),
  created_at timestamptz not null default now(),
  unique (evento_id, ministerio_id)
);

create index escalas_evento_id_idx on escalas (evento_id);
create index escalas_ministerio_id_idx on escalas (ministerio_id);

create table escalacoes (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references escalas (id) on delete cascade,
  perfil_id uuid not null references perfis (id) on delete cascade,
  funcao_id uuid not null references funcoes (id) on delete cascade,
  confirmacao text not null default 'pendente' check (confirmacao in ('pendente', 'confirmado', 'recusado')),
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  unique (escala_id, perfil_id, funcao_id)
);

create index escalacoes_escala_id_idx on escalacoes (escala_id);
create index escalacoes_perfil_id_idx on escalacoes (perfil_id);

-- ---------------------------------------------------------------------------
-- Indisponibilidade e regras por ministério
-- ---------------------------------------------------------------------------

create table indisponibilidades (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis (id) on delete cascade,
  data_inicio date not null,
  data_fim date, -- null = em aberto
  motivo text,
  created_at timestamptz not null default now(),
  constraint indisponibilidades_periodo_valido check (data_fim is null or data_fim >= data_inicio)
);

create index indisponibilidades_perfil_id_idx on indisponibilidades (perfil_id);

create table regras_ministerio (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null unique references ministerios (id) on delete cascade,
  max_escalas_mes integer,
  intervalo_min_dias integer,
  bloquear_conflito_evento boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Repertório de louvor
-- ---------------------------------------------------------------------------

create table categorias_musica (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references ministerios (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0
);

create index categorias_musica_ministerio_id_idx on categorias_musica (ministerio_id);

create table musicas (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references ministerios (id) on delete cascade,
  titulo text not null,
  artista text,
  tom text,
  andamento text,
  categoria text,
  link text,
  ativa boolean not null default true,
  extras jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index musicas_ministerio_id_idx on musicas (ministerio_id);

create table cronograma_itens (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references escalas (id) on delete cascade,
  musica_id uuid not null references musicas (id) on delete restrict,
  ordem integer not null default 0,
  tom_do_dia text,
  momento text,
  observacao text
);

create index cronograma_itens_escala_id_idx on cronograma_itens (escala_id);

-- ---------------------------------------------------------------------------
-- Envios (WhatsApp / push)
-- ---------------------------------------------------------------------------

create table envios (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references escalas (id) on delete cascade,
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'push')),
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'falhou')),
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);

create index envios_escala_id_idx on envios (escala_id);
