-- Inscrições de push do PWA (Fase 3).
-- Cada navegador/aparelho em que a pessoa aceita receber avisos vira uma linha
-- aqui. O envio em si é feito pela Edge Function `enviar-lembretes`, que usa a
-- service role e por isso ignora RLS.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis (id) on delete cascade,
  -- endpoint identifica o aparelho no serviço de push do navegador; é único
  -- globalmente, então serve de chave para o upsert quando a pessoa reinscreve.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_perfil_id_idx on push_subscriptions (perfil_id);

alter table push_subscriptions enable row level security;

-- A pessoa gerencia apenas as próprias inscrições. Ninguém mais precisa lê-las:
-- o líder não tem motivo para ver os aparelhos de quem serve, e o envio roda
-- com service role.
create policy push_subscriptions_select on push_subscriptions
  for select using (perfil_id = auth.uid());

create policy push_subscriptions_insert on push_subscriptions
  for insert with check (perfil_id = auth.uid());

create policy push_subscriptions_update on push_subscriptions
  for update using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy push_subscriptions_delete on push_subscriptions
  for delete using (perfil_id = auth.uid());
