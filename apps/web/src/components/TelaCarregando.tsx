import { Loader2 } from "lucide-react";

/**
 * Espera de tela cheia — só para o momento em que ainda não se sabe se há
 * sessão e perfil, ou seja, antes de existir qualquer layout.
 *
 * Dentro de uma tela que já desenhou, o certo é `EsqueletoLista`: esqueleto
 * com a forma do conteúdo não faz a página pular quando os dados chegam.
 */
export function TelaCarregando({ rotulo = "Carregando..." }: { rotulo?: string }) {
  return (
    <div
      role="status"
      aria-busy
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-fundo text-texto-suave"
    >
      <Loader2 aria-hidden className="size-6 animate-spin text-marca-600" />
      <span className="text-sm">{rotulo}</span>
    </div>
  );
}
