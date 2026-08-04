import { normalizarCodigoConvite } from "@escala-app/core";

/**
 * O código de convite guardado entre a tela de cadastro e a criação do perfil.
 *
 * Sem isto o fluxo quebra no meio: a pessoa abre o link com `?convite=`, cria a
 * conta, o Supabase devolve a sessão — e o código, que só existia na URL, já
 * se perdeu na navegação. Guardar é o que permite aplicar o convite assim que a
 * sessão existe.
 *
 * `sessionStorage` e não `localStorage`: o código vale para esta entrada. Num
 * celular emprestado na igreja, fechar a aba já limpa.
 */
const CHAVE = "escala:convite-pendente";

export function guardarCodigoConvite(codigo: string): void {
  const limpo = normalizarCodigoConvite(codigo);
  if (!limpo) return;
  try {
    sessionStorage.setItem(CHAVE, limpo);
  } catch {
    // Modo privado de alguns navegadores recusa escrita. O convite ainda pode
    // ser digitado no onboarding; não vale derrubar o cadastro por isso.
  }
}

export function lerCodigoConvite(): string | null {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function limparCodigoConvite(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
}
