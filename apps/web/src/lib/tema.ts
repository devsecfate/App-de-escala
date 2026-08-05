/**
 * Tema claro/escuro.
 *
 * A **preferência** guardada tem três valores; o **atributo** no `<html>` só
 * tem dois. Quem escolheu "sistema" fica com `sistema` no `localStorage` e com
 * `claro` ou `escuro` no DOM, resolvido aqui e reavaliado quando o sistema
 * muda. Assim o `index.css` precisa de um bloco escuro só, em vez de repetir
 * os tokens dentro de um `@media (prefers-color-scheme: dark)`.
 *
 * O primeiro desenho da tela não passa por aqui: quem aplica o tema antes da
 * primeira pintura é o script embutido no `index.html`. Sem ele o app pisca
 * branco antes de escurecer, que é pior do que não ter tema escuro.
 */

export type PreferenciaDeTema = "sistema" | "claro" | "escuro";
export type TemaAplicado = "claro" | "escuro";

export const CHAVE_TEMA = "escala:tema";

/** Cor da barra do navegador/sistema em cada tema (o `<meta name="theme-color">`). */
const COR_DA_BARRA: Record<TemaAplicado, string> = {
  claro: "#0f766e",
  escuro: "#0b1220",
};

export function lerPreferencia(): PreferenciaDeTema {
  try {
    const guardada = localStorage.getItem(CHAVE_TEMA);
    if (guardada === "claro" || guardada === "escuro" || guardada === "sistema") {
      return guardada;
    }
  } catch {
    // Modo privado sem localStorage: segue o sistema e não guarda nada.
  }
  return "sistema";
}

export function sistemaPrefereEscuro(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolverTema(preferencia: PreferenciaDeTema): TemaAplicado {
  if (preferencia === "sistema") return sistemaPrefereEscuro() ? "escuro" : "claro";
  return preferencia;
}

/** Escreve o tema resolvido no `<html>` e acerta a cor da barra do navegador. */
export function aplicarTema(preferencia: PreferenciaDeTema): TemaAplicado {
  const tema = resolverTema(preferencia);
  document.documentElement.dataset.tema = tema;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", COR_DA_BARRA[tema]);

  return tema;
}

export function guardarPreferencia(preferencia: PreferenciaDeTema): void {
  try {
    localStorage.setItem(CHAVE_TEMA, preferencia);
  } catch {
    // Sem localStorage a escolha vale só nesta sessão. Tudo bem.
  }
}

/**
 * Avisa quando o sistema troca de claro para escuro. Só importa para quem
 * escolheu "sistema" — quem fixou um tema não deve ver nada mudar debaixo do
 * pé. Devolve a função de cancelar.
 */
export function ouvirTemaDoSistema(aoMudar: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const consulta = window.matchMedia("(prefers-color-scheme: dark)");
  consulta.addEventListener("change", aoMudar);
  return () => consulta.removeEventListener("change", aoMudar);
}
