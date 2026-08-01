// Convida uma pessoa (por e-mail) para um ministério.
//
// - Se a pessoa já tem perfil nesta igreja (já serve em outro ministério),
//   só vincula ao novo ministério.
// - Se é a primeira vez dela no app, cria o usuário de autenticação (envia
//   e-mail de convite via Supabase Auth), o perfil e o vínculo.
//
// Quem chama precisa ser líder do ministério (ou admin da igreja) — a mesma
// checagem usada nas policies de RLS (função SQL `e_lider`).

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ConvidarMembroBody {
  email?: string;
  nome?: string;
  ministerioId?: string;
  papel?: "lider" | "membro";
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    // Sem tipos gerados do schema, os clientes do contexto vêm com o schema
    // fechado (`never`) por padrão; usamos o mesmo cliente "solto" que o
    // resto do projeto usa até rodar `supabase gen types`.
    const supabase = ctx.supabase as unknown as SupabaseClient;
    const supabaseAdmin = ctx.supabaseAdmin as unknown as SupabaseClient;

    const body = (await req.json().catch(() => ({}))) as ConvidarMembroBody;
    const email = body.email?.trim().toLowerCase();
    const nome = body.nome?.trim();
    const ministerioId = body.ministerioId;
    const papel: "lider" | "membro" = body.papel === "lider" ? "lider" : "membro";

    if (!email || !nome || !ministerioId) {
      return Response.json({ message: "email, nome e ministerioId são obrigatórios." }, { status: 400 });
    }

    const { data: podeConvidar, error: erroPermissao } = await supabase.rpc("e_lider", {
      p_ministerio_id: ministerioId,
    });
    if (erroPermissao) {
      return Response.json({ message: erroPermissao.message }, { status: 400 });
    }
    if (!podeConvidar) {
      return Response.json({ message: "Você não é líder deste ministério." }, { status: 403 });
    }

    const { data: meuPerfil, error: erroMeuPerfil } = await supabase
      .from("perfis")
      .select("igreja_id")
      .eq("id", ctx.userClaims!.id)
      .single();
    if (erroMeuPerfil || !meuPerfil) {
      return Response.json({ message: "Perfil de quem está convidando não foi encontrado." }, { status: 400 });
    }
    const igrejaId = (meuPerfil as { igreja_id: string }).igreja_id;

    // Alguém com esse e-mail já tem perfil nesta igreja? Reaproveita em vez
    // de criar um usuário novo (evita duplicar conta se a pessoa já serve
    // em outro ministério).
    const { data: perfilExistente, error: erroBusca } = await supabaseAdmin
      .from("perfis")
      .select("id")
      .eq("email", email)
      .eq("igreja_id", igrejaId)
      .maybeSingle();
    if (erroBusca) {
      return Response.json({ message: erroBusca.message }, { status: 400 });
    }

    let perfilId: string;

    if (perfilExistente) {
      perfilId = (perfilExistente as { id: string }).id;
    } else {
      const { data: convite, error: erroConvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { name: nome },
      });
      if (erroConvite || !convite?.user) {
        return Response.json(
          { message: erroConvite?.message ?? "Não foi possível enviar o convite." },
          { status: 400 },
        );
      }
      perfilId = convite.user.id;

      const { error: erroCriarPerfil } = await supabaseAdmin.from("perfis").insert({
        id: perfilId,
        igreja_id: igrejaId,
        nome,
        email,
        papel_global: "membro",
      });
      if (erroCriarPerfil) {
        return Response.json({ message: erroCriarPerfil.message }, { status: 400 });
      }
    }

    const { data: vinculoExistente, error: erroVinculo } = await supabaseAdmin
      .from("membros_ministerio")
      .select("id, ativo")
      .eq("ministerio_id", ministerioId)
      .eq("perfil_id", perfilId)
      .maybeSingle();
    if (erroVinculo) {
      return Response.json({ message: erroVinculo.message }, { status: 400 });
    }

    if (vinculoExistente) {
      const vinculo = vinculoExistente as { id: string; ativo: boolean };
      if (!vinculo.ativo) {
        const { error } = await supabaseAdmin
          .from("membros_ministerio")
          .update({ ativo: true, papel })
          .eq("id", vinculo.id);
        if (error) return Response.json({ message: error.message }, { status: 400 });
      }
    } else {
      const { error } = await supabaseAdmin
        .from("membros_ministerio")
        .insert({ ministerio_id: ministerioId, perfil_id: perfilId, papel });
      if (error) return Response.json({ message: error.message }, { status: 400 });
    }

    return Response.json({ ok: true, perfilId });
  }),
};

/* Para invocar localmente:

  1. Rode `npx supabase start`
  2. Faça login no app com um usuário líder para pegar o access token, e:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/convidar-membro' \
    --header 'Authorization: Bearer SEU_ACCESS_TOKEN' \
    --header 'Content-Type: application/json' \
    --data '{"email":"nova.pessoa@igreja.test","nome":"Nova Pessoa","ministerioId":"...","papel":"membro"}'

*/
