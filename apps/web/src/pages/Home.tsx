import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck, Check, Sparkles, X } from "lucide-react";
import { confirmarPresenca, listarMinhasEscalacoes, type MinhaEscalacao } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { AtivarAvisos } from "../components/AtivarAvisos";
import { InstalarApp } from "../components/InstalarApp";
import {
  Alerta,
  BadgeConfirmacao,
  Botao,
  Card,
  EsqueletoLista,
  EstadoVazio,
  TituloPagina,
} from "../components/ui";
import { itemDaLista, listaEmCascata } from "../lib/movimento";
import { distanciaEmDias, formatarDataHora } from "../lib/formato";
import { mensagemDeErro } from "../lib/erros-auth";

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? "";
}

export function Home() {
  const { perfil } = useAuth();
  const [escalacoes, setEscalacoes] = useState<MinhaEscalacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setErro(null);
    try {
      setEscalacoes(await listarMinhasEscalacoes(supabase, perfil.id));
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar suas escalas."));
    } finally {
      setCarregando(false);
    }
  }, [perfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function responder(escalacaoId: string, confirmacao: "confirmado" | "recusado") {
    setRespondendo(escalacaoId);
    setErro(null);
    try {
      await confirmarPresenca(supabase, escalacaoId, confirmacao);
      await carregar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível registrar sua resposta."));
    } finally {
      setRespondendo(null);
    }
  }

  const [proxima, ...demais] = escalacoes;

  return (
    <Layout>
      <TituloPagina descricao="Aqui ficam os dias em que você foi escalado para servir.">
        {perfil ? `Olá, ${primeiroNome(perfil.nome)}` : "Minhas escalas"}
      </TituloPagina>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      <div className="mt-5">
        {carregando ? (
          <EsqueletoLista linhas={2} />
        ) : escalacoes.length === 0 ? (
          <EstadoVazio
            icone={<CalendarCheck aria-hidden className="size-6" />}
            titulo="Nenhuma escala por enquanto"
            descricao="Quando um líder te escalar e publicar a escala, o compromisso aparece aqui — e você pode confirmar presença por esta tela."
          />
        ) : (
          <>
            {proxima && (
              <ProximaEscala
                escalacao={proxima}
                respondendo={respondendo === proxima.escalacaoId}
                aoResponder={responder}
              />
            )}

            {demais.length > 0 && (
              <>
                <h2 className="mt-8 text-base font-semibold text-texto">Depois dessa</h2>
                <motion.ul
                  variants={listaEmCascata}
                  initial="oculto"
                  animate="visivel"
                  className="mt-3 space-y-3"
                >
                  <AnimatePresence initial={false}>
                    {demais.map((escalacao) => (
                      <motion.li key={escalacao.escalacaoId} variants={itemDaLista} layout>
                        <EscalaSimples
                          escalacao={escalacao}
                          respondendo={respondendo === escalacao.escalacaoId}
                          aoResponder={responder}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </>
            )}
          </>
        )}
      </div>

      {/* Os dois banners de sistema ficam DEPOIS da escala de propósito: antes,
          "Instale o app" e "Ative os avisos" empurravam para baixo a única
          informação que a pessoa abriu o app para ver. */}
      <div className="mt-8 space-y-3">
        <InstalarApp />
        <AtivarAvisos />
      </div>
    </Layout>
  );
}

/**
 * O cartão da próxima escala, em destaque.
 *
 * É a informação que responde à pergunta que traz a pessoa ao app ("quando eu
 * sirvo?"), então ganha o gradiente da marca, o tamanho maior e a distância em
 * dias — saber que é *hoje* importa mais do que saber que é dia 09.
 */
function ProximaEscala({
  escalacao,
  respondendo,
  aoResponder,
}: {
  escalacao: MinhaEscalacao;
  respondendo: boolean;
  aoResponder: (id: string, confirmacao: "confirmado" | "recusado") => void;
}) {
  const quando = distanciaEmDias(escalacao.dataHora);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card destaque className="relative overflow-hidden">
        {/* Brilho decorativo no canto — o "efeito de superfície" do plano. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-marca-300/25 blur-3xl"
        />

        <div className="relative">
          <p className="flex items-center gap-1.5 text-sm font-medium text-marca-100">
            <Sparkles aria-hidden className="size-4" />
            Sua próxima escala · {quando}
          </p>

          <p className="mt-3 text-xl font-bold tracking-tight">{escalacao.eventoTitulo}</p>
          <p className="mt-1 text-marca-100">{formatarDataHora(escalacao.dataHora)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              {escalacao.ministerioNome}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              {escalacao.funcaoNome}
            </span>
          </div>

          {escalacao.confirmacao === "pendente" ? (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Botao
                className="bg-white text-marca-800 hover:bg-marca-50 sm:flex-1"
                icone={<Check aria-hidden className="size-4" />}
                carregando={respondendo}
                onClick={() => aoResponder(escalacao.escalacaoId, "confirmado")}
              >
                Vou servir
              </Botao>
              <Botao
                className="border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:flex-1"
                variante="fantasma"
                icone={<X aria-hidden className="size-4" />}
                disabled={respondendo}
                onClick={() => aoResponder(escalacao.escalacaoId, "recusado")}
              >
                Não posso
              </Botao>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
                {escalacao.confirmacao === "confirmado" ? (
                  <>
                    <Check aria-hidden className="size-4" /> Presença confirmada
                  </>
                ) : (
                  <>
                    <X aria-hidden className="size-4" /> Você avisou que não pode
                  </>
                )}
              </span>
              <button
                type="button"
                disabled={respondendo}
                onClick={() =>
                  aoResponder(
                    escalacao.escalacaoId,
                    escalacao.confirmacao === "confirmado" ? "recusado" : "confirmado",
                  )
                }
                className="text-sm font-medium text-marca-100 underline underline-offset-2 hover:text-white disabled:opacity-60"
              >
                {escalacao.confirmacao === "confirmado" ? "Não vou mais poder" : "Consegui, vou servir"}
              </button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function EscalaSimples({
  escalacao,
  respondendo,
  aoResponder,
}: {
  escalacao: MinhaEscalacao;
  respondendo: boolean;
  aoResponder: (id: string, confirmacao: "confirmado" | "recusado") => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-texto-suave">{escalacao.ministerioNome}</p>
          <p className="mt-0.5 font-semibold text-texto">{escalacao.eventoTitulo}</p>
          <p className="mt-0.5 text-sm text-texto-suave">{formatarDataHora(escalacao.dataHora)}</p>
          <p className="mt-1.5 text-sm text-texto">
            Função: <span className="font-medium">{escalacao.funcaoNome}</span>
          </p>
        </div>
        <BadgeConfirmacao confirmacao={escalacao.confirmacao} />
      </div>

      {escalacao.confirmacao === "pendente" && (
        <div className="mt-3 flex gap-2 border-t border-borda pt-3">
          <Botao
            tamanho="pequeno"
            icone={<Check aria-hidden className="size-4" />}
            carregando={respondendo}
            onClick={() => aoResponder(escalacao.escalacaoId, "confirmado")}
          >
            Vou servir
          </Botao>
          <Botao
            tamanho="pequeno"
            variante="secundario"
            disabled={respondendo}
            onClick={() => aoResponder(escalacao.escalacaoId, "recusado")}
          >
            Não posso
          </Botao>
        </div>
      )}
    </Card>
  );
}
