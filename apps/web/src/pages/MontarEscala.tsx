import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Send, Share2, Trash2, Undo2, UserCog } from "lucide-react";
import {
  definirEscalacao,
  despublicarEscala,
  funcoesObrigatoriasFaltando,
  gerarTextoEscala,
  linkWhatsApp,
  listarCategoriasMusica,
  listarCronograma,
  listarEscalacoesPorFuncao,
  listarMembrosDoMinisterio,
  listarMusicas,
  obterContextoValidacaoEscalacao,
  obterEvento,
  obterMinisterio,
  obterOuCriarEscala,
  obterUltimoEnvio,
  publicarEscala,
  registrarEnvio,
  removerEscala,
  validarEscalacao,
  type CategoriaMusica,
  type Envio,
  type Escala,
  type EscalacaoDaFuncao,
  type Evento,
  type ItemCronograma,
  type MembroMinisterioComPerfil,
  type Ministerio,
  type Musica,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { Cronograma } from "../components/escala/Cronograma";
import {
  Alerta,
  Badge,
  BadgeConfirmacao,
  Botao,
  BotaoLink,
  CampoSelect,
  Card,
  ConfirmarAcao,
  EsqueletoLista,
  EstadoVazio,
  MenuAcoes,
  TituloPagina,
} from "../components/ui";
import { itemDaLista, listaEmCascata } from "../lib/movimento";
import { formatarDataHora } from "../lib/formato";
import { mensagemDeErro } from "../lib/erros-auth";

interface MensagensValidacao {
  bloqueios: string[];
  avisos: string[];
}

export function MontarEscala() {
  const { eventoId, ministerioId } = useParams<{ eventoId: string; ministerioId: string }>();
  const { perfil } = useAuth();
  const navegar = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [ministerio, setMinisterio] = useState<Ministerio | null>(null);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [linhas, setLinhas] = useState<EscalacaoDaFuncao[]>([]);
  const [membros, setMembros] = useState<MembroMinisterioComPerfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagensPorFuncao, setMensagensPorFuncao] = useState<Record<string, MensagensValidacao>>({});
  const [ultimoEnvio, setUltimoEnvio] = useState<Envio | null>(null);
  const [cronograma, setCronograma] = useState<ItemCronograma[]>([]);
  const [repertorio, setRepertorio] = useState<Musica[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMusica[]>([]);
  const [despublicando, setDespublicando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    if (!eventoId || !ministerioId || !perfil) return;
    setErro(null);
    try {
      const [eventoCarregado, ministerioCarregado, membrosCarregados] = await Promise.all([
        obterEvento(supabase, eventoId),
        obterMinisterio(supabase, ministerioId),
        listarMembrosDoMinisterio(supabase, ministerioId),
      ]);
      setEvento(eventoCarregado);
      setMinisterio(ministerioCarregado);
      setMembros(membrosCarregados);

      const escalaAtual = await obterOuCriarEscala(supabase, eventoId, ministerioId, perfil.id);
      setEscala(escalaAtual);

      const [linhasCarregadas, envioCarregado, cronogramaCarregado, repertorioCarregado, categoriasCarregadas] =
        await Promise.all([
          listarEscalacoesPorFuncao(supabase, escalaAtual.id, ministerioId),
          obterUltimoEnvio(supabase, escalaAtual.id),
          listarCronograma(supabase, escalaAtual.id),
          listarMusicas(supabase, ministerioId),
          listarCategoriasMusica(supabase, ministerioId),
        ]);
      setLinhas(linhasCarregadas);
      setUltimoEnvio(envioCarregado);
      setCronograma(cronogramaCarregado);
      setRepertorio(repertorioCarregado);
      setCategorias(categoriasCarregadas);
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar a escala."));
    } finally {
      setCarregando(false);
    }
  }, [eventoId, ministerioId, perfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alterarEscalacao(linha: EscalacaoDaFuncao, perfilId: string) {
    if (!escala || !evento || !ministerioId) return;
    setErro(null);
    setMensagensPorFuncao((atual) => ({ ...atual, [linha.funcaoId]: { bloqueios: [], avisos: [] } }));
    try {
      if (perfilId) {
        const contexto = await obterContextoValidacaoEscalacao(supabase, {
          pessoaId: perfilId,
          ministerioId,
          funcaoId: linha.funcaoId,
          dataEvento: evento.dataHora.slice(0, 10),
          eventoId: evento.id,
          escalaId: escala.id,
        });
        const resultado = validarEscalacao(contexto);
        if (resultado.bloqueios.length > 0) {
          setMensagensPorFuncao((atual) => ({
            ...atual,
            [linha.funcaoId]: { bloqueios: resultado.bloqueios.map((b) => b.mensagem), avisos: [] },
          }));
          return;
        }
        if (resultado.avisos.length > 0) {
          setMensagensPorFuncao((atual) => ({
            ...atual,
            [linha.funcaoId]: { bloqueios: [], avisos: resultado.avisos.map((a) => a.mensagem) },
          }));
        }
      }
      await definirEscalacao(supabase, escala.id, linha.funcaoId, perfilId || null, linha.escalacaoId);
      setLinhas(await listarEscalacoesPorFuncao(supabase, escala.id, ministerioId));
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar a escalação."));
    }
  }

  async function recarregarCronograma() {
    if (!escala) return;
    setCronograma(await listarCronograma(supabase, escala.id));
  }

  async function compartilhar() {
    if (!escala || !evento || !ministerio) return;
    setErro(null);

    const texto = gerarTextoEscala({
      ministerioNome: ministerio.nome,
      eventoTitulo: evento.titulo,
      dataHora: evento.dataHora,
      observacoes: evento.observacoes,
      itens: linhas.map((linha) => ({ funcaoNome: linha.funcaoNome, pessoaNome: linha.perfilNome })),
      cronograma: cronograma.map((item) => ({
        titulo: item.musicaTitulo,
        tom: item.tomDoDia ?? item.musicaTom,
        momento: item.momento,
      })),
    });

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: texto });
      } else {
        window.open(linkWhatsApp(texto), "_blank", "noopener");
      }
    } catch (problema) {
      // Fechar a folha de compartilhamento não é erro nem envio.
      if (problema instanceof DOMException && problema.name === "AbortError") return;
      setErro(mensagemDeErro(problema, "Não foi possível compartilhar a escala."));
      return;
    }

    try {
      setUltimoEnvio(await registrarEnvio(supabase, escala.id, "whatsapp"));
    } catch {
      // A escala já saiu; o histórico é secundário e não vale um erro vermelho.
    }
  }

  async function publicar() {
    if (!escala) return;
    setPublicando(true);
    setErro(null);
    try {
      await publicarEscala(supabase, escala.id);
      setEscala({ ...escala, status: "publicada", publicadaEm: new Date().toISOString() });
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível publicar a escala."));
    } finally {
      setPublicando(false);
    }
  }

  async function confirmarDespublicar() {
    if (!escala) return;
    await despublicarEscala(supabase, escala.id);
    setEscala({ ...escala, status: "rascunho", publicadaEm: null });
  }

  async function confirmarExclusao() {
    if (!escala) return;
    await removerEscala(supabase, escala.id);
    navegar("/eventos");
  }

  if (carregando) {
    return (
      <Layout>
        <EsqueletoLista linhas={4} />
      </Layout>
    );
  }

  if (!evento || !ministerio || !escala) {
    return (
      <Layout>
        <EstadoVazio
          titulo="Escala não encontrada"
          descricao="O evento ou o ministério pode ter sido excluído."
          acao={
            <BotaoLink to="/eventos" icone={<ArrowLeft aria-hidden className="size-4" />}>
              Voltar para a agenda
            </BotaoLink>
          }
        />
      </Layout>
    );
  }

  const publicada = escala.status === "publicada";
  const escaladas = linhas.filter((linha) => linha.perfilId).length;
  const vazia = escaladas === 0 && cronograma.length === 0;
  const faltando = funcoesObrigatoriasFaltando(
    linhas.filter((linha) => linha.obrigatoria).map((linha) => ({ id: linha.funcaoId, nome: linha.funcaoNome })),
    linhas.filter((linha) => linha.perfilId).map((linha) => linha.funcaoId),
  );

  return (
    <Layout>
      <button
        type="button"
        onClick={() => navegar(-1)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-texto-suave transition hover:text-texto"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Voltar
      </button>

      <TituloPagina
        descricao={`${ministerio.nome} · ${formatarDataHora(evento.dataHora)}`}
        acoes={
          <MenuAcoes
            rotulo="Ações da escala"
            acoes={[
              {
                rotulo: "Voltar para rascunho",
                icone: <Undo2 aria-hidden className="size-4" />,
                desabilitada: !publicada,
                detalhe: publicada
                  ? "Some da tela de quem foi escalado até você publicar de novo."
                  : "A escala já é um rascunho.",
                aoEscolher: () => setDespublicando(true),
              },
              {
                rotulo: "Excluir esta escala",
                icone: <Trash2 aria-hidden className="size-4" />,
                tom: "perigo",
                desabilitada: !vazia,
                detalhe: vazia
                  ? "Rascunho vazio: some sem deixar rastro."
                  : "Tire todo mundo da escala antes de excluí-la.",
                aoEscolher: () => setExcluindo(true),
              },
            ]}
          />
        }
      >
        {evento.titulo}
      </TituloPagina>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tom={publicada ? "sucesso" : "atencao"}>{publicada ? "Publicada" : "Rascunho"}</Badge>
        <Badge tom="neutro">
          {escaladas} de {linhas.length} {linhas.length === 1 ? "função preenchida" : "funções preenchidas"}
        </Badge>
        {!publicada && (
          <span className="text-sm text-texto-suave">Ninguém vê esta escala até você publicar.</span>
        )}
      </div>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      {faltando.length > 0 && (
        <Alerta className="mt-4" tipo="aviso" titulo="Funções obrigatórias vazias">
          Ainda falta gente em: {faltando.map((funcao) => funcao.nome).join(", ")}.
        </Alerta>
      )}

      <div className="mt-6">
        {linhas.length === 0 ? (
          <EstadoVazio
            icone={<UserCog aria-hidden className="size-6" />}
            titulo="Este ministério não tem funções"
            descricao="Sem função cadastrada não há o que preencher. Cadastre pelo menos uma na tela do ministério."
            acao={
              <BotaoLink variante="primario" to={`/ministerios/${ministerio.id}`}>
                Abrir {ministerio.nome}
              </BotaoLink>
            }
          />
        ) : (
          <motion.ul variants={listaEmCascata} initial="oculto" animate="visivel" className="space-y-3">
            {linhas.map((linha) => {
              const mensagens = mensagensPorFuncao[linha.funcaoId];
              return (
                <motion.li key={linha.funcaoId} variants={itemDaLista}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-texto">{linha.funcaoNome}</span>
                        {linha.obrigatoria && <Badge tom="atencao">Obrigatória</Badge>}
                        {linha.arquivada && <Badge tom="neutro">Função arquivada</Badge>}
                      </div>
                      <BadgeConfirmacao confirmacao={linha.confirmacao} pontoDeVista="lider" />
                    </div>

                    <CampoSelect
                      rotulo={`Quem serve em ${linha.funcaoNome}`}
                      rotuloOculto
                      classeContainer="mt-3"
                      value={linha.perfilId ?? ""}
                      onChange={(evento) => void alterarEscalacao(linha, evento.target.value)}
                    >
                      <option value="">Ninguém escalado</option>
                      {membros.map((membro) => (
                        <option key={membro.perfilId} value={membro.perfilId}>
                          {membro.nome}
                        </option>
                      ))}
                    </CampoSelect>

                    {mensagens?.bloqueios.map((mensagem) => (
                      <Alerta key={mensagem} className="mt-2" tipo="erro">
                        {mensagem}
                      </Alerta>
                    ))}
                    {mensagens?.avisos.map((mensagem) => (
                      <Alerta key={mensagem} className="mt-2" tipo="aviso">
                        {mensagem}
                      </Alerta>
                    ))}
                  </Card>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>

      {/* Só faz sentido para ministério que mantém repertório (louvor). */}
      {(repertorio.length > 0 || cronograma.length > 0) && escala && (
        <Cronograma
          escalaId={escala.id}
          itens={cronograma}
          repertorio={repertorio}
          categorias={categorias}
          aoMudar={recarregarCronograma}
          definirItens={setCronograma}
        />
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        {!publicada ? (
          <Botao
            tamanho="grande"
            icone={<Send aria-hidden className="size-4" />}
            carregando={publicando}
            onClick={() => void publicar()}
          >
            Publicar escala
          </Botao>
        ) : (
          <Botao
            tamanho="grande"
            icone={<Share2 aria-hidden className="size-4" />}
            onClick={() => void compartilhar()}
          >
            Compartilhar no WhatsApp
          </Botao>
        )}
      </div>

      {publicada && ultimoEnvio?.enviadoEm && (
        <p className="mt-2 text-sm text-texto-suave">
          Compartilhada pela última vez em {formatarDataHora(ultimoEnvio.enviadoEm)}.
        </p>
      )}

      <ConfirmarAcao
        aberto={despublicando}
        aoFechar={() => setDespublicando(false)}
        titulo="Voltar a escala para rascunho?"
        descricao="Ela some da tela de quem foi escalado até você publicar de novo. Quem já confirmou presença continua confirmado."
        rotuloConfirmar="Voltar para rascunho"
        variante="primario"
        aoConfirmar={confirmarDespublicar}
      />

      <ConfirmarAcao
        aberto={excluindo}
        aoFechar={() => setExcluindo(false)}
        titulo="Excluir esta escala?"
        descricao="Ela está vazia, então nada de histórico se perde. Abrir esta tela de novo cria um rascunho novo."
        rotuloConfirmar="Excluir"
        aoConfirmar={confirmarExclusao}
      />
    </Layout>
  );
}
