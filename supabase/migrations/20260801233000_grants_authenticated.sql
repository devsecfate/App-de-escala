-- Permissões de tabela para os papéis do Supabase.
--
-- As policies de RLS (migration 20260801051737) decidem QUAIS LINHAS cada
-- pessoa enxerga, mas RLS só entra em cena depois do GRANT: sem privilégio de
-- tabela, o Postgres barra antes, com "permission denied for table X".
--
-- O Postgres do Supabase concede por default apenas REFERENCES/TRIGGER/TRUNCATE
-- às tabelas novas do schema public, então todo SELECT/INSERT/UPDATE/DELETE do
-- app estava sendo negado. Este grant é o que faltava.
--
-- `anon` fica de fora de propósito: não existe tela pública neste app: toda
-- policy depende de auth.uid()/minha_igreja(), que não valem nada sem login.
--
-- Migration futura que criar tabela nova precisa conceder de novo — não usamos
-- `alter default privileges` porque tabela sem RLS herdaria acesso amplo em
-- silêncio, enquanto esquecer o grant falha alto e é fácil de achar.

grant select, insert, update, delete on all tables in schema public to authenticated;

-- A Edge Function `enviar-lembretes` roda com service role (ignora RLS, mas
-- precisa do grant como qualquer outro papel).
grant select, insert, update, delete on all tables in schema public to service_role;

-- Sem sequences no schema: todas as chaves primárias são uuid.
