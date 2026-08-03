import { useEffect, useState } from "react";

/**
 * Convite para instalar o app na tela inicial (Fase 5).
 *
 * O Chrome/Edge/Android avisam por `beforeinstallprompt` e deixam abrir a
 * caixa de instalação na hora. O iOS não tem esse evento: lá o jeito é
 * ensinar o caminho (Compartilhar → Adicionar à Tela de Início).
 *
 * Some sozinho quando o app já está instalado — quem abriu pelo atalho não
 * precisa de convite — e some de vez se a pessoa dispensar.
 */

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE_DISPENSADO = "escala:convite-de-instalacao-dispensado";

function jaEstaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  // `standalone` é a versão do iOS, que não implementa display-mode.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

function ehIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // O iPad moderno se apresenta como Mac; o que o entrega é a tela sensível ao toque.
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export function InstalarApp() {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [instalado, setInstalado] = useState(jaEstaInstalado);
  const [dispensado, setDispensado] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(CHAVE_DISPENSADO) === "1",
  );

  useEffect(() => {
    function aoPoderInstalar(evento: Event) {
      // Sem o preventDefault o Chrome mostra a barra dele; queremos o convite
      // dentro do app, no momento em que a pessoa já entendeu para que serve.
      evento.preventDefault();
      setEvento(evento as EventoDeInstalacao);
    }

    function aoInstalar() {
      setInstalado(true);
      setEvento(null);
    }

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado || dispensado) return null;
  // Nem instalável pelo navegador, nem iOS: não há o que oferecer.
  if (!evento && !ehIos()) return null;

  function dispensar() {
    setDispensado(true);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {
      // Sem localStorage (modo privado) o convite volta na próxima visita. Tudo bem.
    }
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const escolha = await evento.userChoice;
    // O evento é de uso único: o navegador manda outro se a pessoa recusar agora.
    setEvento(null);
    if (escolha.outcome === "accepted") setInstalado(true);
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">Instalar na tela inicial</p>
          <p className="text-sm text-slate-500">
            {evento
              ? "Abre como app, em tela cheia, e a escala fica disponível mesmo sem internet."
              : "No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {evento && (
            <button
              type="button"
              onClick={() => void instalar()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Instalar
            </button>
          )}
          <button
            type="button"
            onClick={dispensar}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
