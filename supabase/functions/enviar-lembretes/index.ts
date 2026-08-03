// Lembrete de véspera (Fase 3): avisa no celular quem serve amanhã.
//
// Feito para ser chamado uma vez por dia por um agendador (pg_cron / Supabase
// Scheduled Functions) — ver o comentário no fim do arquivo. Não é uma função
// de usuário: roda com service role e se protege com um segredo compartilhado.
//
// A conta de "amanhã" mora em packages/core/src/datas.ts e o texto do aviso em
// packages/core/src/lembretes.ts, os dois testados com vitest, para o fuso de
// cada igreja ser respeitado sem duplicar a lógica aqui. Os dois arquivos são
// importados direto (sem bundler), então nenhum deles pode importar outra coisa
// do core: o Deno não resolveria os `.js` do TypeScript.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { intervaloDoDiaSeguinte } from "../../../packages/core/src/datas.ts";
import { gerarLembreteVespera } from "../../../packages/core/src/lembretes.ts";

interface IgrejaRow {
  id: string;
  nome: string;
  fuso_horario: string;
}

interface EscalacaoRow {
  id: string;
  perfil_id: string;
  funcoes: { nome: string } | null;
  escalas: {
    ministerios: { nome: string } | null;
    eventos: { titulo: string; data_hora: string } | null;
  } | null;
}

interface InscricaoRow {
  id: string;
  perfil_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function variavelObrigatoria(nome: string): string {
  const valor = Deno.env.get(nome);
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada.`);
  return valor;
}

/** Busca quem serve amanhã nesta igreja, ignorando quem já disse que não pode. */
async function escalacoesDeAmanha(
  supabase: SupabaseClient,
  igreja: IgrejaRow,
  agora: Date,
): Promise<EscalacaoRow[]> {
  const intervalo = intervaloDoDiaSeguinte(agora, igreja.fuso_horario);

  const { data, error } = await supabase
    .from("escalacoes")
    .select(
      "id, perfil_id, funcoes(nome), escalas!inner(status, ministerios!inner(nome), eventos!inner(titulo, data_hora, igreja_id))",
    )
    .eq("escalas.status", "publicada")
    .eq("escalas.eventos.igreja_id", igreja.id)
    .gte("escalas.eventos.data_hora", intervalo.inicio)
    .lt("escalas.eventos.data_hora", intervalo.fim)
    .neq("confirmacao", "recusado");

  if (error) throw error;
  return (data ?? []) as unknown as EscalacaoRow[];
}

export default {
  async fetch(req: Request): Promise<Response> {
    // Qualquer um que alcance a URL poderia disparar notificação para a igreja
    // inteira; o segredo é o que impede isso.
    const segredo = variavelObrigatoria("LEMBRETES_SECRET");
    if (req.headers.get("x-lembretes-secret") !== segredo) {
      return Response.json({ message: "Não autorizado." }, { status: 401 });
    }

    webpush.setVapidDetails(
      variavelObrigatoria("VAPID_SUBJECT"),
      variavelObrigatoria("VAPID_PUBLIC_KEY"),
      variavelObrigatoria("VAPID_PRIVATE_KEY"),
    );

    const supabase = createClient(
      variavelObrigatoria("SUPABASE_URL"),
      variavelObrigatoria("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const agora = new Date();
    let enviados = 0;
    let semInscricao = 0;
    const inscricoesMortas: string[] = [];

    const { data: igrejas, error: erroIgrejas } = await supabase
      .from("igrejas")
      .select("id, nome, fuso_horario");
    if (erroIgrejas) {
      return Response.json({ message: erroIgrejas.message }, { status: 500 });
    }

    for (const igreja of (igrejas ?? []) as IgrejaRow[]) {
      const escalacoes = await escalacoesDeAmanha(supabase, igreja, agora);
      if (escalacoes.length === 0) continue;

      const perfilIds = [...new Set(escalacoes.map((e) => e.perfil_id))];
      const { data: inscricoes, error: erroInscricoes } = await supabase
        .from("push_subscriptions")
        .select("id, perfil_id, endpoint, p256dh, auth")
        .in("perfil_id", perfilIds);
      if (erroInscricoes) throw erroInscricoes;

      const porPerfil = new Map<string, InscricaoRow[]>();
      for (const inscricao of (inscricoes ?? []) as InscricaoRow[]) {
        const lista = porPerfil.get(inscricao.perfil_id) ?? [];
        lista.push(inscricao);
        porPerfil.set(inscricao.perfil_id, lista);
      }

      for (const escalacao of escalacoes) {
        const evento = escalacao.escalas?.eventos;
        const ministerio = escalacao.escalas?.ministerios;
        if (!evento || !ministerio) continue;

        const aparelhos = porPerfil.get(escalacao.perfil_id) ?? [];
        if (aparelhos.length === 0) {
          semInscricao += 1;
          continue;
        }

        const conteudo = gerarLembreteVespera({
          eventoTitulo: evento.titulo,
          dataHora: evento.data_hora,
          ministerioNome: ministerio.nome,
          funcaoNome: escalacao.funcoes?.nome ?? "sua função",
          fusoHorario: igreja.fuso_horario,
        });

        for (const aparelho of aparelhos) {
          try {
            await webpush.sendNotification(
              {
                endpoint: aparelho.endpoint,
                keys: { p256dh: aparelho.p256dh, auth: aparelho.auth },
              },
              JSON.stringify(conteudo),
            );
            enviados += 1;
          } catch (erro) {
            // 404/410 = o navegador descartou a inscrição (app desinstalado,
            // permissão revogada). Limpamos em vez de tentar para sempre.
            const status = (erro as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              inscricoesMortas.push(aparelho.id);
            } else {
              console.error("Falha ao enviar push", aparelho.endpoint, erro);
            }
          }
        }
      }
    }

    if (inscricoesMortas.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", inscricoesMortas);
    }

    return Response.json({
      ok: true,
      enviados,
      semInscricao,
      inscricoesRemovidas: inscricoesMortas.length,
    });
  },
};

/* Agendamento e segredos.

  1. Gere o par de chaves VAPID uma vez:

     deno eval 'import w from "npm:web-push@^3.6.7"; console.log(w.generateVAPIDKeys())'

  2. Configure os segredos do projeto (a pública também vai para o front,
     como VITE_VAPID_PUBLIC_KEY em apps/web/.env):

     npx supabase secrets set \
       VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
       VAPID_SUBJECT=mailto:contato@suaigreja.com \
       LEMBRETES_SECRET=$(openssl rand -hex 32)

  3. Agende uma chamada diária (ex.: 18h de Brasília = 21h UTC). Isso precisa do
     project-ref real, por isso ainda não está numa migration:

     select cron.schedule(
       'lembretes-vespera', '0 21 * * *',
       $$ select net.http_post(
            url := 'https://<project-ref>.supabase.co/functions/v1/enviar-lembretes',
            headers := '{"x-lembretes-secret": "<LEMBRETES_SECRET>"}'::jsonb
          ) $$
     );

  Para testar local (com `npx supabase start` e `supabase functions serve`):

     curl -i --request POST 'http://127.0.0.1:54321/functions/v1/enviar-lembretes' \
       --header 'x-lembretes-secret: <LEMBRETES_SECRET>'
*/
