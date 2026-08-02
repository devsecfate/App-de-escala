-- Seed para desenvolvimento local (supabase db reset).
-- Cria uma igreja de exemplo com os 7 ministérios de ministerios/ministerios.md,
-- algumas funções e pessoas fictícias, para testar o app sem cadastrar tudo à mão.
--
-- Usuários de teste (login por e-mail/senha, senha "senha123" para todos):
--   admin@igreja.test          -> admin da igreja
--   lider.louvor@igreja.test   -> líder do ministério de Louvor
--   lider.tecnologia@igreja.test -> líder do ministério de Tecnologia
--   vocal1@igreja.test         -> membro do Louvor (função Vocal)
--   projecao1@igreja.test      -> membro da Tecnologia (função Projeção)
--
-- Só roda em ambiente local. Nunca aplique este seed num projeto de produção.

do $$
declare
  v_igreja_id uuid := gen_random_uuid();

  v_admin_id uuid := gen_random_uuid();
  v_lider_louvor_id uuid := gen_random_uuid();
  v_lider_tecnologia_id uuid := gen_random_uuid();
  v_vocal1_id uuid := gen_random_uuid();
  v_projecao1_id uuid := gen_random_uuid();

  v_min_tecnologia_id uuid := gen_random_uuid();
  v_min_midias_id uuid := gen_random_uuid();
  v_min_louvor_id uuid := gen_random_uuid();
  v_min_acolhimento_id uuid := gen_random_uuid();
  v_min_evangelismo_id uuid := gen_random_uuid();
  v_min_social_id uuid := gen_random_uuid();
  v_min_espiritualidade_id uuid := gen_random_uuid();

  v_membro_vocal1 uuid;
  v_membro_projecao1 uuid;

  v_funcao_vocal uuid;
  v_funcao_projecao uuid;

  v_senha_hash text := crypt('senha123', gen_salt('bf'));
begin
  -- Igreja ----------------------------------------------------------------
  insert into igrejas (id, nome, fuso_horario)
  values (v_igreja_id, 'Igreja Exemplo', 'America/Sao_Paulo');

  -- Usuários de autenticação (auth.users + auth.identities) ---------------
  --
  -- confirmation_token, recovery_token, email_change_token_new e email_change
  -- precisam ser string vazia, NUNCA null: o GoTrue lê essas colunas em campos
  -- de texto não-anuláveis e, com null, todo login morre com
  -- "Database error querying schema" (erro 500 em /auth/v1/token). Elas são as
  -- únicas colunas de texto de auth.users sem default no Postgres do Supabase.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
     'admin@igreja.test', v_senha_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"name":"Admin da Igreja"}', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_lider_louvor_id, 'authenticated', 'authenticated',
     'lider.louvor@igreja.test', v_senha_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"name":"Líder do Louvor"}', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_lider_tecnologia_id, 'authenticated', 'authenticated',
     'lider.tecnologia@igreja.test', v_senha_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"name":"Líder da Tecnologia"}', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_vocal1_id, 'authenticated', 'authenticated',
     'vocal1@igreja.test', v_senha_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"name":"Vocal Um"}', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_projecao1_id, 'authenticated', 'authenticated',
     'projecao1@igreja.test', v_senha_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"name":"Projeção Um"}', '', '', '', '');

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
  )
  select
    gen_random_uuid(), u.id::text, u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email', now(), now(), now()
  from auth.users u
  where u.id in (v_admin_id, v_lider_louvor_id, v_lider_tecnologia_id, v_vocal1_id, v_projecao1_id);

  -- Perfis ------------------------------------------------------------------
  insert into perfis (id, igreja_id, nome, email, papel_global) values
    (v_admin_id, v_igreja_id, 'Admin da Igreja', 'admin@igreja.test', 'admin'),
    (v_lider_louvor_id, v_igreja_id, 'Líder do Louvor', 'lider.louvor@igreja.test', 'membro'),
    (v_lider_tecnologia_id, v_igreja_id, 'Líder da Tecnologia', 'lider.tecnologia@igreja.test', 'membro'),
    (v_vocal1_id, v_igreja_id, 'Vocal Um', 'vocal1@igreja.test', 'membro'),
    (v_projecao1_id, v_igreja_id, 'Projeção Um', 'projecao1@igreja.test', 'membro');

  -- Ministérios (ministerios/ministerios.md) --------------------------------
  insert into ministerios (id, igreja_id, nome, ordem) values
    (v_min_tecnologia_id, v_igreja_id, 'Tecnologia (projeção e luz)', 1),
    (v_min_midias_id, v_igreja_id, 'Mídias', 2),
    (v_min_louvor_id, v_igreja_id, 'Louvor', 3),
    (v_min_acolhimento_id, v_igreja_id, 'Acolhimento', 4),
    (v_min_evangelismo_id, v_igreja_id, 'Evangelismo', 5),
    (v_min_social_id, v_igreja_id, 'Social', 6),
    (v_min_espiritualidade_id, v_igreja_id, 'Espiritualidade', 7);

  -- Funções (sugestão inicial da tabela de ministerios.md) -------------------
  insert into funcoes (ministerio_id, nome, obrigatoria) values
    (v_min_tecnologia_id, 'Projeção', true),
    (v_min_tecnologia_id, 'Som', true),
    (v_min_tecnologia_id, 'Luz', false),
    (v_min_midias_id, 'Fotografia', false),
    (v_min_midias_id, 'Redes sociais', false),
    (v_min_midias_id, 'Transmissão', false),
    (v_min_louvor_id, 'Vocal', true),
    (v_min_louvor_id, 'Violão', false),
    (v_min_louvor_id, 'Teclado', false),
    (v_min_louvor_id, 'Bateria', false),
    (v_min_louvor_id, 'Baixo', false);

  select id into v_funcao_vocal from funcoes where ministerio_id = v_min_louvor_id and nome = 'Vocal';
  select id into v_funcao_projecao from funcoes where ministerio_id = v_min_tecnologia_id and nome = 'Projeção';

  -- Membros dos ministérios ---------------------------------------------------
  insert into membros_ministerio (id, ministerio_id, perfil_id, papel) values
    (gen_random_uuid(), v_min_louvor_id, v_lider_louvor_id, 'lider'),
    (gen_random_uuid(), v_min_tecnologia_id, v_lider_tecnologia_id, 'lider'),
    (gen_random_uuid(), v_min_louvor_id, v_vocal1_id, 'membro'),
    (gen_random_uuid(), v_min_tecnologia_id, v_projecao1_id, 'membro');

  select id into v_membro_vocal1
  from membros_ministerio where ministerio_id = v_min_louvor_id and perfil_id = v_vocal1_id;

  select id into v_membro_projecao1
  from membros_ministerio where ministerio_id = v_min_tecnologia_id and perfil_id = v_projecao1_id;

  insert into membro_funcoes (membro_ministerio_id, funcao_id) values
    (v_membro_vocal1, v_funcao_vocal),
    (v_membro_projecao1, v_funcao_projecao);

  -- Regras de exemplo (uma por ministério com gente) ---------------------------
  insert into regras_ministerio (ministerio_id, max_escalas_mes, intervalo_min_dias, bloquear_conflito_evento) values
    (v_min_louvor_id, 4, 7, false),
    (v_min_tecnologia_id, 4, 7, false);

  -- Um evento e uma escala de exemplo (rascunho) --------------------------------
  insert into eventos (igreja_id, titulo, data_hora, tipo)
  values (v_igreja_id, 'Culto de domingo', (current_date + interval '7 days' + interval '18 hours'), 'culto');
end $$;
