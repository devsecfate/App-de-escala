/**
 * Junta classes ignorando `false`, `null` e `undefined`.
 * Não faz merge de conflito do Tailwind (não vale trazer `tailwind-merge` só
 * para isso): quem passa `className` por cima escreve a classe vencedora.
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
