import { useEffect, useState } from "react";
import { Alerta, Botao, Card } from "./ui";
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
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-texto">Avisos no celular</p>
          <p className="mt-0.5 text-sm text-texto-suave">
            {inscrito
              ? "Você recebe um lembrete na véspera de cada escala."
              : "Receba um lembrete na véspera de cada escala."}
          </p>
        </div>
        <Botao
          tamanho="pequeno"
          variante={inscrito ? "secundario" : "primario"}
          carregando={ocupado}
          onClick={() => void (inscrito ? handleDesativar() : handleAtivar())}
        >
          {inscrito ? "Desativar" : "Ativar"}
        </Botao>
      </div>
      {erro && (
        <Alerta className="mt-3" tipo="erro">
          {erro}
        </Alerta>
      )}
    </Card>
  );
}
