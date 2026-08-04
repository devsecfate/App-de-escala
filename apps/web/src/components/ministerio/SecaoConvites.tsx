import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, Copy, KeyRound, MessageCircle, Ticket } from "lucide-react";
import {
  cancelarConvite,
  conviteAtivo,
  criarConvite,
  formatarCodigoConvite,
  linkConviteWhatsApp,
  listarConvites,
  textoConviteWhatsApp,
  type Convite,
  type PapelMinisterio,
} from "@escala-app/core";
import { supabase } from "../../lib/supabase";
import {
  Alerta,
  Badge,
  Botao,
  Campo,
  CampoSelect,
  Card,
  ConfirmarAcao,
  EstadoVazio,
  Esqueleto,
  MenuAcoes,
  Modal,
  Secao,
} from "../ui";
import { itemDaLista, listaEmCascata } from "../../lib/movimento";
import { formatarData } from "../../lib/formato";
import { mensagemDeErro } from "../../lib/erros-auth";

function situacao(convite: Convite): { rotulo: string; tom: "sucesso" | "neutro" | "perigo" } {
  if (convite.canceladoEm) return { rotulo: "Cancelado", tom: "perigo" };
  if (convite.usos >= convite.usosMax) return { rotulo: "Esgotado", tom: "neutro" };
  if (new Date(convite.expiraEm).getTime() <= Date.now()) return { rotulo: "Vencido", tom: "neutro" };
  return { rotulo: "Válido", tom: "sucesso" };
}

/**
 * Os códigos de convite do ministério.
 *
 * A Etapa 1 criou o mecanismo (a RPC `criar_convite`) mas nenhuma tela: o
 * líder só conseguia gerar código chamando a função por fora do app. Aqui ele
 * gera, copia a mensagem pronta e cancela o que vazou.
 */
export function SecaoConvites({
  ministerioId,
  ministerioNome,
  igrejaNome,
  souLider,
}: {
  ministerioId: string;
  ministerioNome: string;
  igrejaNome?: string;
  souLider: boolean;
}) {
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [cancelando, setCancelando] = useState<Convite | null>(null);
  const [recemCriado, setRecemCriado] = useState<Convite | null>(null);

  const carregar = useCallback(async () => {
    if (!souLider) {
      setCarregando(false);
      return;
    }
    setErro(null);
    try {
      setConvites(await listarConvites(supabase, ministerioId));
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar os convites."));
    } finally {
      setCarregando(false);
    }
  }, [ministerioId, souLider]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!souLider) return null;

  const contexto = { igrejaNome, ministerioNome };
  const urlDoApp = typeof window === "undefined" ? "" : window.location.origin;

  async function copiar(convite: Convite, apenasCodigo: boolean) {
    setAviso(null);
    setErro(null);
    const texto = apenasCodigo
      ? formatarCodigoConvite(convite.codigo)
      : textoConviteWhatsApp(convite, urlDoApp, contexto);
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(apenasCodigo ? "Código copiado." : "Mensagem copiada — é só colar onde quiser.");
    } catch {
      // `navigator.clipboard` exige HTTPS (ou localhost) e permissão. Quando
      // falha, o código continua visível no cartão para copiar na mão.
      setErro("Não consegui copiar sozinho. O código está aí no cartão para copiar à mão.");
    }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return;
    await cancelarConvite(supabase, cancelando.id);
    await carregar();
  }

  const validos = convites.filter((convite) => conviteAtivo(convite));

  return (
    <Secao
      titulo="Convites"
      descricao="Gere um código, mande por WhatsApp e a pessoa entra direto neste ministério."
      acoes={
        <Botao
          tamanho="pequeno"
          variante="secundario"
          icone={<Ticket aria-hidden className="size-4" />}
          onClick={() => setCriando(true)}
        >
          Gerar código
        </Botao>
      }
    >
      {erro && (
        <Alerta className="mb-3" tipo="erro">
          {erro}
        </Alerta>
      )}
      {aviso && (
        <Alerta className="mb-3" tipo="sucesso">
          {aviso}
        </Alerta>
      )}

      {carregando ? (
        <Esqueleto className="h-24 w-full" />
      ) : convites.length === 0 ? (
        <EstadoVazio
          icone={<KeyRound aria-hidden className="size-6" />}
          titulo="Nenhum convite gerado"
          descricao="O código não depende de e-mail: quem receber cria a conta, digita o código e já entra no ministério."
          acao={
            <Botao icone={<Ticket aria-hidden className="size-4" />} onClick={() => setCriando(true)}>
              Gerar o primeiro
            </Botao>
          }
        />
      ) : (
        <motion.ul variants={listaEmCascata} initial="oculto" animate="visivel" className="space-y-3">
          <AnimatePresence initial={false}>
            {convites.map((convite) => {
              const estado = situacao(convite);
              const ativo = conviteAtivo(convite);
              return (
                <motion.li key={convite.id} variants={itemDaLista} layout>
                  <Card>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-lg font-bold tracking-widest text-texto">
                            {formatarCodigoConvite(convite.codigo)}
                          </span>
                          <Badge tom={estado.tom}>{estado.rotulo}</Badge>
                          {convite.papel === "lider" && <Badge tom="marca">Entra como líder</Badge>}
                        </div>
                        <p className="mt-1.5 text-sm text-texto-suave">
                          {convite.usos} de {convite.usosMax} usos · vale até{" "}
                          {formatarData(convite.expiraEm)}
                        </p>
                      </div>

                      <MenuAcoes
                        rotulo="Ações do convite"
                        acoes={[
                          {
                            rotulo: "Copiar mensagem",
                            icone: <MessageCircle aria-hidden className="size-4" />,
                            aoEscolher: () => void copiar(convite, false),
                          },
                          {
                            rotulo: "Copiar só o código",
                            icone: <Copy aria-hidden className="size-4" />,
                            aoEscolher: () => void copiar(convite, true),
                          },
                          {
                            rotulo: "Cancelar convite",
                            icone: <Ban aria-hidden className="size-4" />,
                            tom: "perigo",
                            desabilitada: !ativo,
                            detalhe: ativo ? undefined : "Este código já não vale.",
                            aoEscolher: () => setCancelando(convite),
                          },
                        ]}
                      />
                    </div>

                    {ativo && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-borda pt-3">
                        <Botao
                          tamanho="pequeno"
                          icone={<MessageCircle aria-hidden className="size-4" />}
                          onClick={() =>
                            window.open(linkConviteWhatsApp(convite, urlDoApp, contexto), "_blank", "noopener")
                          }
                        >
                          Mandar no WhatsApp
                        </Botao>
                        <Botao
                          tamanho="pequeno"
                          variante="secundario"
                          icone={<Copy aria-hidden className="size-4" />}
                          onClick={() => void copiar(convite, false)}
                        >
                          Copiar mensagem
                        </Botao>
                      </div>
                    )}
                  </Card>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      {validos.length === 0 && convites.length > 0 && (
        <p className="mt-3 text-sm text-texto-suave">
          Nenhum código válido no momento — gere um novo para convidar mais alguém.
        </p>
      )}

      <NovoConviteModal
        aberto={criando}
        ministerioId={ministerioId}
        aoFechar={() => setCriando(false)}
        aoCriar={async (convite) => {
          setRecemCriado(convite);
          await carregar();
        }}
      />

      <Modal
        aberto={recemCriado !== null}
        aoFechar={() => setRecemCriado(null)}
        titulo="Código gerado"
        descricao="Mande para a pessoa. Ela cria a conta, digita o código e já entra neste ministério."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setRecemCriado(null)}>
              Fechar
            </Botao>
            {recemCriado && (
              <Botao
                icone={<MessageCircle aria-hidden className="size-4" />}
                onClick={() =>
                  window.open(linkConviteWhatsApp(recemCriado, urlDoApp, contexto), "_blank", "noopener")
                }
              >
                Mandar no WhatsApp
              </Botao>
            )}
          </>
        }
      >
        {recemCriado && (
          <div className="rounded-cartao border border-marca-200 bg-marca-50 px-4 py-5 text-center">
            <p className="font-mono text-3xl font-bold tracking-[0.2em] text-marca-800">
              {formatarCodigoConvite(recemCriado.codigo)}
            </p>
            <p className="mt-2 text-sm text-marca-800/80">
              Vale até {formatarData(recemCriado.expiraEm)} · {recemCriado.usosMax}{" "}
              {recemCriado.usosMax === 1 ? "uso" : "usos"}
            </p>
          </div>
        )}
      </Modal>

      <ConfirmarAcao
        aberto={cancelando !== null}
        aoFechar={() => setCancelando(null)}
        titulo="Cancelar este convite?"
        descricao="O código para de funcionar na hora. Quem já entrou com ele continua no ministério."
        rotuloConfirmar="Cancelar convite"
        aoConfirmar={confirmarCancelamento}
      />
    </Secao>
  );
}

function NovoConviteModal({
  aberto,
  ministerioId,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  ministerioId: string;
  aoFechar: () => void;
  aoCriar: (convite: Convite) => Promise<void>;
}) {
  const [papel, setPapel] = useState<PapelMinisterio>("membro");
  const [usosMax, setUsosMax] = useState("1");
  const [validoPorDias, setValidoPorDias] = useState("7");
  const [nomeSugerido, setNomeSugerido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setPapel("membro");
    setUsosMax("1");
    setValidoPorDias("7");
    setNomeSugerido("");
    setErro(null);
  }, [aberto]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const convite = await criarConvite(supabase, {
        ministerioId,
        papel,
        usosMax: Number(usosMax),
        validoPorDias: Number(validoPorDias),
        nomeSugerido: nomeSugerido.trim() || null,
      });
      aoFechar();
      await aoCriar(convite);
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível gerar o código."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Gerar código de convite">
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <CampoSelect
          rotulo="A pessoa entra como"
          value={papel}
          onChange={(evento) => setPapel(evento.target.value as PapelMinisterio)}
        >
          <option value="membro">Membro — pode ser escalado</option>
          <option value="lider">Líder — monta e publica a escala</option>
        </CampoSelect>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Quantas pessoas podem usar"
            type="number"
            min={1}
            max={100}
            value={usosMax}
            dica="Um código só para uma pessoa, ou um só para o grupo todo."
            onChange={(evento) => setUsosMax(evento.target.value)}
          />
          <Campo
            rotulo="Vale por (dias)"
            type="number"
            min={1}
            max={90}
            value={validoPorDias}
            onChange={(evento) => setValidoPorDias(evento.target.value)}
          />
        </div>

        <Campo
          rotulo="Nome sugerido"
          dica="Opcional. Só é usado se a pessoa não digitar o nome dela no cadastro."
          value={nomeSugerido}
          onChange={(evento) => setNomeSugerido(evento.target.value)}
        />

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando}>
            Gerar código
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
