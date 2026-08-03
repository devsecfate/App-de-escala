import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entrarComo, idDoMinisterio, idDoPerfil, USUARIOS } from "./ambiente.js";
import {
  confirmarPresenca,
  criarEvento,
  definirEscalacao,
  listarMinhasEscalacoes,
  obterIgreja,
  obterOuCriarEscala,
  obterRelatorioParticipacao,
  publicarEscala,
} from "../index.js";

/**
 * Relatório de participação (Fase 5) contra o Postgres real.
 *
 * Os eventos são criados em março de 2025 — um mês que nenhum outro teste
 * toca — para a contagem ser determinística, e o mês é limpo antes de cada
 * execução para a suíte poder rodar duas vezes seguidas sem `db reset`.
 */
describe("relatório de participação contra o banco real", () => {
  let lider: SupabaseClient;
  let vocal: SupabaseClient;
  let idLouvor: string;
  let idLider: string;
  let idVocal: string;
  let idFuncaoVocal: string;
  let idProjecao: string;
  let fusoHorario: string;
  let idPrimeiroEvento: string;

  const MARCO = { inicio: "2025-03-01", fim: "2025-03-31" };

  async function escalarEmEvento(quandoIso: string, publicar: boolean) {
    const { data: perfil } = await lider.from("perfis").select("igreja_id").eq("id", idLider).single();
    const evento = await criarEvento(
      lider,
      (perfil as { igreja_id: string }).igreja_id,
      `Culto relatório ${quandoIso}`,
      quandoIso,
    );
    const escala = await obterOuCriarEscala(lider, evento.id, idLouvor, idLider);
    await definirEscalacao(lider, escala.id, idFuncaoVocal, idVocal);
    if (publicar) await publicarEscala(lider, escala.id);
    return { eventoId: evento.id, escalaId: escala.id };
  }

  beforeAll(async () => {
    lider = await entrarComo(USUARIOS.liderLouvor);
    vocal = await entrarComo(USUARIOS.vocal1);

    idLouvor = await idDoMinisterio(lider, "Louvor");
    idLider = await idDoPerfil(lider, USUARIOS.liderLouvor);
    idVocal = await idDoPerfil(lider, USUARIOS.vocal1);

    const { data: funcao } = await lider
      .from("funcoes")
      .select("id")
      .eq("ministerio_id", idLouvor)
      .eq("nome", "Vocal")
      .single();
    idFuncaoVocal = (funcao as { id: string }).id;

    const { data: perfil } = await lider.from("perfis").select("igreja_id").eq("id", idLider).single();
    const igreja = await obterIgreja(lider, (perfil as { igreja_id: string }).igreja_id);
    fusoHorario = igreja!.fusoHorario;
    // O seed cria a igreja em São Paulo; a conta de fuso do teste depende disso.
    expect(fusoHorario).toBe("America/Sao_Paulo");

    // Limpeza: apagar evento é coisa de admin (a policy impede o líder de
    // derrubar evento com escala de outro ministério). Cascata leva junto
    // escalas e escalações.
    const admin = await entrarComo(USUARIOS.admin);
    const { error: erroLimpeza } = await admin
      .from("eventos")
      .delete()
      .gte("data_hora", "2025-03-01T00:00:00Z")
      .lt("data_hora", "2025-05-01T00:00:00Z");
    if (erroLimpeza) throw erroLimpeza;

    idPrimeiroEvento = (await escalarEmEvento("2025-03-05T22:00:00Z", true)).eventoId; // conta
    await escalarEmEvento("2025-03-19T22:00:00Z", true); // conta
    await escalarEmEvento("2025-03-26T22:00:00Z", false); // rascunho: não conta
    await escalarEmEvento("2025-04-10T22:00:00Z", true); // fora do período
    // 01/04 01:00 UTC é 31/03 22:00 em São Paulo: culto de março.
    await escalarEmEvento("2025-04-01T01:00:00Z", true);

    // A Tecnologia serve no mesmo culto de 05/03, para o relatório do Louvor
    // ter algo real de outro ministério para ignorar.
    const liderTecnologia = await entrarComo(USUARIOS.liderTecnologia);
    const idTecnologia = await idDoMinisterio(liderTecnologia, "Tecnologia (projeção e luz)");
    const idLiderTecnologia = await idDoPerfil(liderTecnologia, USUARIOS.liderTecnologia);
    idProjecao = await idDoPerfil(liderTecnologia, USUARIOS.projecao1);

    const { data: funcaoProjecao } = await liderTecnologia
      .from("funcoes")
      .select("id")
      .eq("ministerio_id", idTecnologia)
      .eq("nome", "Projeção")
      .single();

    const escalaTecnologia = await obterOuCriarEscala(
      liderTecnologia,
      idPrimeiroEvento,
      idTecnologia,
      idLiderTecnologia,
    );
    await definirEscalacao(
      liderTecnologia,
      escalaTecnologia.id,
      (funcaoProjecao as { id: string }).id,
      idProjecao,
    );
    await publicarEscala(liderTecnologia, escalaTecnologia.id);
  });

  it("conta as escalações publicadas de cada pessoa no período", async () => {
    const relatorio = await obterRelatorioParticipacao(lider, {
      ministerioId: idLouvor,
      dataInicio: MARCO.inicio,
      dataFim: MARCO.fim,
      fusoHorario,
    });

    const linhaDoVocal = relatorio.linhas.find((linha) => linha.perfilId === idVocal);
    expect(linhaDoVocal?.vezes).toBe(3);
    expect(relatorio.totalEscalacoes).toBe(3);
  });

  it("não conta escala em rascunho", async () => {
    // Semana em que só existe o evento de 26/03, cuja escala ficou em rascunho.
    const semanaDoRascunho = await obterRelatorioParticipacao(lider, {
      ministerioId: idLouvor,
      dataInicio: "2025-03-24",
      dataFim: "2025-03-28",
      fusoHorario,
    });

    expect(semanaDoRascunho.totalEscalacoes).toBe(0);
    expect(semanaDoRascunho.linhas.every((linha) => linha.vezes === 0)).toBe(true);
  });

  it("inclui o culto da noite do último dia do mês, no fuso da igreja", async () => {
    // O mesmo período em UTC cru deixaria de fora o evento de 01/04 01:00Z.
    const soAteODia30 = await obterRelatorioParticipacao(lider, {
      ministerioId: idLouvor,
      dataInicio: MARCO.inicio,
      dataFim: "2025-03-30",
      fusoHorario,
    });

    expect(soAteODia30.totalEscalacoes).toBe(2);
  });

  it("mostra com zero quem não foi escalado no período", async () => {
    const relatorio = await obterRelatorioParticipacao(lider, {
      ministerioId: idLouvor,
      dataInicio: MARCO.inicio,
      dataFim: MARCO.fim,
      fusoHorario,
    });

    const linhaDoLider = relatorio.linhas.find((linha) => linha.perfilId === idLider);
    expect(linhaDoLider?.vezes).toBe(0);
    expect(linhaDoLider?.ultimaVez).toBeNull();
    expect(relatorio.pessoasSemServir).toBeGreaterThanOrEqual(1);
  });

  it("separa confirmadas de pendentes", async () => {
    const minhasEscalas = await listarMinhasEscalacoes(vocal, idVocal);
    const deMarco = minhasEscalas.find((escalacao) => escalacao.dataHora.startsWith("2025-03-05"));
    expect(deMarco).toBeDefined();
    await confirmarPresenca(vocal, deMarco!.escalacaoId, "confirmado");

    const relatorio = await obterRelatorioParticipacao(lider, {
      ministerioId: idLouvor,
      dataInicio: MARCO.inicio,
      dataFim: MARCO.fim,
      fusoHorario,
    });

    const linhaDoVocal = relatorio.linhas.find((linha) => linha.perfilId === idVocal);
    expect(linhaDoVocal?.confirmadas).toBe(1);
    expect(linhaDoVocal?.pendentes).toBe(2);
  });

  it("não mistura a escala de outro ministério no mesmo evento", async () => {
    // A Tecnologia também serviu no culto de 05/03. Se o filtro por ministério
    // escorregasse, o número do Louvor subiria sem ninguém perceber.
    const relatorio = await obterRelatorioParticipacao(lider, {
      ministerioId: idLouvor,
      dataInicio: MARCO.inicio,
      dataFim: MARCO.fim,
      fusoHorario,
    });

    expect(relatorio.totalEscalacoes).toBe(3);
    expect(relatorio.linhas.some((linha) => linha.perfilId === idProjecao)).toBe(false);
  });
});
