import { describe, expect, it } from "vitest";
import { chaveDoRotulo } from "./musicas.js";

describe("chaveDoRotulo", () => {
  it("normaliza o rótulo digitado pelo líder", () => {
    expect(chaveDoRotulo("Quem canta")).toBe("quem_canta");
  });

  it("remove acentos", () => {
    expect(chaveDoRotulo("Instrumento principal é")).toBe("instrumento_principal_e");
    expect(chaveDoRotulo("Observação")).toBe("observacao");
  });

  it("junta pontuação e espaços repetidos num separador só", () => {
    expect(chaveDoRotulo("BPM / andamento")).toBe("bpm_andamento");
    expect(chaveDoRotulo("Tom   do   dia")).toBe("tom_do_dia");
  });

  it("não deixa separador sobrando nas pontas", () => {
    expect(chaveDoRotulo("  Link do vídeo!  ")).toBe("link_do_video");
    expect(chaveDoRotulo("(BPM)")).toBe("bpm");
  });

  it("mantém números", () => {
    expect(chaveDoRotulo("Tom 2")).toBe("tom_2");
  });
});
