import type { SupabaseClient } from "../supabase.js";
import type { StatusConfirmacao } from "../types.js";
import { intervaloDeDatasLocais } from "../datas.js";
import { resumirParticipacoes, type ParticipacaoBruta, type RelatorioParticipacao } from "../relatorio.js";
import { listarMembrosDoMinisterio } from "./membros.js";

export interface ParametrosRelatorio {
  ministerioId: string;
  /** AAAA-MM-DD, inclusivo */
  dataInicio: string;
  /** AAAA-MM-DD, inclusivo */
  dataFim: string;
  /** fuso da igreja: define o que é "dia 1" e "dia 31" */
  fusoHorario: string;
}

interface ParticipacaoRow {
  perfil_id: string;
  confirmacao: string;
  perfis: { nome: string } | { nome: string }[] | null;
  funcoes: { nome: string } | { nome: string }[] | null;
  escalas:
    | { eventos: { data_hora: string } | { data_hora: string }[] | null }
    | { eventos: { data_hora: string } | { data_hora: string }[] | null }[]
    | null;
}

function primeiro<T>(valor: T | T[] | null): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

/**
 * Quantas vezes cada pessoa do ministério serviu entre as duas datas.
 *
 * Conta só escala publicada: rascunho ainda é intenção do líder, não trabalho
 * feito. O intervalo é resolvido no fuso da igreja para o culto da noite do
 * último dia do mês não escorregar para o mês seguinte.
 */
export async function obterRelatorioParticipacao(
  client: SupabaseClient,
  params: ParametrosRelatorio,
): Promise<RelatorioParticipacao> {
  const intervalo = intervaloDeDatasLocais(params.dataInicio, params.dataFim, params.fusoHorario);

  const [participacoesRes, membros] = await Promise.all([
    client
      .from("escalacoes")
      .select(
        "perfil_id, confirmacao, perfis(nome), funcoes(nome), escalas!inner(ministerio_id, status, eventos!inner(data_hora))",
      )
      .eq("escalas.ministerio_id", params.ministerioId)
      .eq("escalas.status", "publicada")
      .gte("escalas.eventos.data_hora", intervalo.inicio)
      .lt("escalas.eventos.data_hora", intervalo.fim),
    listarMembrosDoMinisterio(client, params.ministerioId),
  ]);

  if (participacoesRes.error) throw participacoesRes.error;

  const participacoes: ParticipacaoBruta[] = ((participacoesRes.data ?? []) as unknown as ParticipacaoRow[]).map(
    (linha) => {
      const escala = primeiro(linha.escalas);
      const evento = primeiro(escala?.eventos ?? null);
      return {
        perfilId: linha.perfil_id,
        nome: primeiro(linha.perfis)?.nome ?? "(sem nome)",
        dataHora: evento?.data_hora ?? "",
        funcaoNome: primeiro(linha.funcoes)?.nome ?? "",
        confirmacao: linha.confirmacao as StatusConfirmacao,
      };
    },
  );

  return resumirParticipacoes(
    membros.map((membro) => ({ perfilId: membro.perfilId, nome: membro.nome })),
    participacoes,
  );
}
