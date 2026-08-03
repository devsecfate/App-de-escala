/**
 * Nome do cache de leitura offline (Fase 5), compartilhado entre o service
 * worker (que grava) e o app (que apaga no logout).
 *
 * Este arquivo é importado pelos dois mundos — janela e worker — então só pode
 * usar APIs que existem nos dois. `caches` é uma delas.
 */

export const CACHE_DE_DADOS = "escala-dados-v1";

/**
 * Apaga as respostas do Supabase guardadas no aparelho.
 *
 * Chamado no logout: os dados da escala de uma igreja não podem sobrar no
 * navegador para a próxima pessoa que logar no mesmo aparelho — celular
 * emprestado na igreja é situação comum, não exceção.
 */
export async function limparDadosOffline(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(CACHE_DE_DADOS);
  } catch {
    // Cache indisponível (modo privado, cota) não pode impedir o logout.
  }
}
