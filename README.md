# App de Escala

App para organizar a escala de pessoas que servem na igreja, separadas por ministério. Este repositório tem duas partes: a documentação de produto (markdown) e o código do app (monorepo).

## Estrutura

- `memoria/` memória local do projeto (contexto, decisões, histórico)
- `planejamento/` planejamento de produto e arquitetura técnica do app
- `regras/` regras de negócio da escala (quem pode servir, frequência, restrições)
- `ferramentas/` ferramentas e integrações usadas pelo app
- `ministerios/` cadastro de cada ministério e seus líderes
- `pessoas/` cadastro de pessoas e a qual ministério pertencem
- `escalas/` escalas geradas, por período
- `repertorio/` biblioteca de louvores predefinidos, usada para montar o cronograma do ministério de louvor
- `apps/web/` front-end (React + Vite + Tailwind, PWA)
- `packages/core/` domínio, motor de regras e cliente Supabase — sem dependência de DOM, reaproveitável pelo futuro app nativo
- `supabase/` migrations SQL (schema + RLS) e seed de dados de teste

## Como usar (documentação de produto)

1. Cadastre os ministérios em `ministerios/`.
2. Cadastre as pessoas em `pessoas/`, associando cada uma ao seu ministério.
3. Defina as regras de escala em `regras/regras.md`.
4. As escalas geradas ficam salvas em `escalas/`, uma por período.
5. `memoria/memoria.md` guarda o contexto acumulado do projeto, atualizado conforme o app evolui.

## Como rodar o app localmente

Pré-requisitos: Node.js 20+, Docker Desktop (para o Supabase local).

```bash
npm install

# banco local (schema + RLS + dados de teste em supabase/seed.sql)
npx supabase start

# copie apps/web/.env.example para apps/web/.env e preencha com a URL/anon key
# que o "supabase start" imprimiu no terminal
cp apps/web/.env.example apps/web/.env

npm run dev       # sobe o front-end em http://localhost:5173
npm test          # testes do motor de regras (packages/core)
npm run build     # build de produção (typecheck + bundle do front-end)
```

Login de teste (criado pelo seed, senha `senha123` para todos):

| E-mail | Papel |
|---|---|
| `admin@igreja.test` | admin da igreja |
| `lider.louvor@igreja.test` | líder do Louvor |
| `lider.tecnologia@igreja.test` | líder da Tecnologia |
| `vocal1@igreja.test` | membro do Louvor |
| `projecao1@igreja.test` | membro da Tecnologia |

Detalhes de arquitetura, modelo de dados e roadmap: `planejamento/arquitetura.md` e `planejamento/planejamento.md`.
