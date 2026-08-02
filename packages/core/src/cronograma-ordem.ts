/**
 * Reordenação do cronograma (Fase 4). Pura e separada da API para dar para
 * testar a conta de mover item sem banco — e para a UI conseguir mostrar a
 * nova ordem antes de a gravação terminar.
 */

/**
 * Devolve uma nova lista com o item de `origem` movido para `destino`.
 * Índices fora da lista devolvem a lista intacta, em vez de embaralhar.
 */
export function moverItem<T>(itens: readonly T[], origem: number, destino: number): T[] {
  const resultado = [...itens];
  if (
    origem === destino ||
    origem < 0 ||
    destino < 0 ||
    origem >= resultado.length ||
    destino >= resultado.length
  ) {
    return resultado;
  }

  const [movido] = resultado.splice(origem, 1);
  // splice acima já garante que `movido` existe (origem está dentro da lista).
  resultado.splice(destino, 0, movido as T);
  return resultado;
}

/** Próxima posição livre no fim do cronograma. */
export function proximaOrdem(itens: readonly { ordem: number }[]): number {
  if (itens.length === 0) return 0;
  return Math.max(...itens.map((item) => item.ordem)) + 1;
}
