import { createSupabaseClient } from "@escala-app/core";

/**
 * Tira espaços e BOM (U+FEFF) das variáveis antes de usar.
 *
 * Não é paranoia: a chave vai dentro de um cabeçalho HTTP, e cabeçalho só
 * aceita Latin-1. Um BOM invisível na frente do valor — que é o que acontece
 * quando o valor é gravado no painel de deploy por um terminal que
 * acrescenta BOM — faz o `fetch` recusar a requisição inteira com
 * "String contains non ISO-8859-1 code point", antes de sair do navegador.
 * O app fica 100% mudo, sem uma linha no log do servidor para investigar.
 */
function limpar(valor: string | undefined): string | undefined {
  // \uFEFF escrito com escape de propósito: o caractere literal é invisível
  // no editor, e ninguém consegue revisar o que não vê.
  return valor?.replace(/^\uFEFF/, "").trim();
}

const url = limpar(import.meta.env.VITE_SUPABASE_URL);
const anonKey = limpar(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!url || !anonKey) {
  throw new Error(
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em apps/web/.env (veja apps/web/.env.example).",
  );
}

export const supabase = createSupabaseClient(url, anonKey);
