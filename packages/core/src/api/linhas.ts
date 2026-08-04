/**
 * Guarda contra a falha mais traiçoeira deste projeto.
 *
 * Quando a RLS filtra todas as linhas de um UPDATE ou DELETE, o PostgREST não
 * devolve erro: devolve sucesso com zero linhas afetadas. O `if (error) throw`
 * passa limpo, a tela recarrega, e o item que a pessoa acabou de excluir volta
 * para a lista sem uma palavra de explicação. Ela tenta de novo, e de novo.
 *
 * Por isso toda função de escrita pede `.select("id")` e passa por aqui: sem
 * linha de volta, é porque a permissão não existia ou o id não existe mais, e
 * as duas coisas merecem uma frase em português na tela.
 */
export function exigirLinhaAfetada(
  linhas: { id: string }[] | null,
  mensagem: string,
): { id: string }[] {
  if (!linhas || linhas.length === 0) {
    throw new Error(mensagem);
  }
  return linhas;
}

/** Mensagem padrão de quem não tem permissão para mexer no item. */
export function semPermissao(oQue: string): string {
  return `Não foi possível alterar ${oQue}. Ou o item já não existe, ou você não tem permissão para mexer nele.`;
}
