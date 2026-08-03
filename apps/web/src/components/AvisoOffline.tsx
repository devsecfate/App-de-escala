import { useEffect, useState } from "react";

/**
 * Faixa que aparece quando o aparelho está sem internet (Fase 5).
 *
 * O app continua abrindo e mostrando a escala — o service worker guarda as
 * leituras —, mas escrever (confirmar presença, publicar escala) precisa de
 * rede. Sem este aviso a pessoa tentaria confirmar e levaria um erro seco.
 */
export function AvisoOffline() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const marcarOnline = () => setOffline(false);
    const marcarOffline = () => setOffline(true);

    window.addEventListener("online", marcarOnline);
    window.addEventListener("offline", marcarOffline);
    return () => {
      window.removeEventListener("online", marcarOnline);
      window.removeEventListener("offline", marcarOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-sm text-amber-800">
      Sem internet — mostrando o que está salvo no aparelho. Confirmar presença e editar a escala
      volta a funcionar quando a conexão voltar.
    </div>
  );
}
