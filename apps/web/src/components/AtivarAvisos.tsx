import { useEffect, useState } from "react";
import { removerInscricaoPush, salvarInscricaoPush } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/**
 * Liga/desliga os avisos no celular (lembrete de véspera da Fase 3).
 *
 * Some da tela quando o navegador não suporta push ou quando a chave VAPID
 * não está configurada — o recurso é opcional e não pode derrubar a Home.
 */

const CHAVE_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function suportaPush(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * A chave VAPID vem em base64url; o navegador pede os bytes crus.
 * O buffer é criado explicitamente para o tipo sair como `Uint8Array<ArrayBuffer>`
 * (e não `ArrayBufferLike`), que é o que `applicationServerKey` aceita.
 */
function base64UrlParaBytes(base64Url: string) {
  const preenchimento = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

export function AtivarAvisos() {
  const { perfil } = useAuth();
  const [inscrito, setInscrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [disponivel, setDisponivel] = useState(false);

  useEffect(() => {
    if (!CHAVE_VAPID || !suportaPush()) return;
    setDisponivel(true);

    void navigator.serviceWorker.ready
      .then((registro) => registro.pushManager.getSubscription())
      .then((inscricao) => setInscrito(!!inscricao))
      .catch(() => setInscrito(false));
  }, []);

  if (!disponivel || !perfil) return null;

  async function handleAtivar() {
    setOcupado(true);
    setErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setErro("Você precisa permitir as notificações no navegador para receber os lembretes.");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaBytes(CHAVE_VAPID!),
      });

      const dados = inscricao.toJSON();
      const p256dh = dados.keys?.p256dh;
      const auth = dados.keys?.auth;
      if (!dados.endpoint || !p256dh || !auth) {
        throw new Error("O navegador devolveu uma inscrição de push incompleta.");
      }

      await salvarInscricaoPush(supabase, perfil!.id, { endpoint: dados.endpoint, p256dh, auth });
      setInscrito(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível ativar os avisos.");
    } finally {
      setOcupado(false);
    }
  }

  async function handleDesativar() {
    setOcupado(true);
    setErro(null);
    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();
      if (inscricao) {
        await removerInscricaoPush(supabase, inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setInscrito(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível desativar os avisos.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">Avisos no celular</p>
          <p className="text-sm text-slate-500">
            {inscrito
              ? "Você recebe um lembrete na véspera de cada escala."
              : "Receba um lembrete na véspera de cada escala."}
          </p>
        </div>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void (inscrito ? handleDesativar() : handleAtivar())}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            inscrito
              ? "border border-slate-300 text-slate-700 hover:bg-slate-50"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {ocupado ? "..." : inscrito ? "Desativar" : "Ativar"}
        </button>
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
