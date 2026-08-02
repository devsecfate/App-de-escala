import type { SupabaseClient } from "../supabase.js";

/**
 * Inscrição de push de um aparelho. Formato deliberadamente "burro" (só
 * strings) para o core continuar sem DOM: quem converte o `PushSubscription`
 * do navegador para isto é a camada de UI.
 */
export interface InscricaoPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Registra o aparelho para receber avisos. `endpoint` é único: reinscrever o
 * mesmo aparelho atualiza a linha em vez de duplicar.
 */
export async function salvarInscricaoPush(
  client: SupabaseClient,
  perfilId: string,
  inscricao: InscricaoPush,
): Promise<void> {
  const { error } = await client.from("push_subscriptions").upsert(
    {
      perfil_id: perfilId,
      endpoint: inscricao.endpoint,
      p256dh: inscricao.p256dh,
      auth: inscricao.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function removerInscricaoPush(client: SupabaseClient, endpoint: string): Promise<void> {
  const { error } = await client.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}
