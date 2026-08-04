import { cx } from "../../lib/cx";

/**
 * Bloco cinza pulsando no lugar das 9 cópias de "Carregando..." em texto.
 * O esqueleto tem a forma do que vai chegar, então a tela não pula quando o
 * conteúdo entra — e quem está numa rede ruim vê que algo está vindo.
 *
 * `aria-hidden`: para o leitor de tela isto é decoração. Quem anuncia o
 * carregamento é o `aria-busy` da região, não estes retângulos.
 */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx("animate-pulsar-suave rounded-lg bg-superficie-suave", className)}
    />
  );
}

/** Alguns cards vazios, no formato das listas do app. */
export function EsqueletoLista({ linhas = 3 }: { linhas?: number }) {
  return (
    <div role="status" aria-busy aria-label="Carregando" className="space-y-3">
      {Array.from({ length: linhas }, (_, indice) => (
        <div
          key={indice}
          className="rounded-cartao border border-borda bg-superficie p-4 shadow-cartao"
        >
          <Esqueleto className="h-3 w-24" />
          <Esqueleto className="mt-2.5 h-4 w-2/3" />
          <Esqueleto className="mt-2 h-3 w-1/2" />
        </div>
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
