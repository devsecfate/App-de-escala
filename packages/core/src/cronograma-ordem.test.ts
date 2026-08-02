import { describe, expect, it } from "vitest";
import { moverItem, proximaOrdem } from "./cronograma-ordem.js";

describe("moverItem", () => {
  const base = ["a", "b", "c", "d"];

  it("move um item para baixo", () => {
    expect(moverItem(base, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("move um item para cima", () => {
    expect(moverItem(base, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("não altera a lista original", () => {
    moverItem(base, 0, 3);
    expect(base).toEqual(["a", "b", "c", "d"]);
  });

  it("devolve a lista intacta quando origem e destino são iguais", () => {
    expect(moverItem(base, 2, 2)).toEqual(base);
  });

  it("ignora índices fora da lista em vez de embaralhar", () => {
    expect(moverItem(base, -1, 2)).toEqual(base);
    expect(moverItem(base, 0, 9)).toEqual(base);
    expect(moverItem(base, 9, 0)).toEqual(base);
  });

  it("lida com lista vazia", () => {
    expect(moverItem([], 0, 1)).toEqual([]);
  });
});

describe("proximaOrdem", () => {
  it("começa em zero no cronograma vazio", () => {
    expect(proximaOrdem([])).toBe(0);
  });

  it("vai para o fim, mesmo com ordens fora de sequência", () => {
    expect(proximaOrdem([{ ordem: 0 }, { ordem: 5 }, { ordem: 2 }])).toBe(6);
  });
});
