import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Crown,
  ShieldCheck,
  ShieldMinus,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import {
  definirPapelDoMembro,
  definirPapelGlobal,
  definirPerfilAtivo,
  listarPessoasDaIgreja,
  type PessoaDaIgreja,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import {
  Alerta,
  Alternador,
  Badge,
  BotaoLink,
  Card,
  ConfirmarAcao,
  EsqueletoLista,
  EstadoVazio,
  MenuAcoes,
  TituloPagina,
  type AcaoDoMenu,
} from "../components/ui";
import { itemDaLista, listaEmCascata } from "../lib/movimento";
import { mensagemDeErro } from "../lib/erros-auth";

type Aba = "ativos" | "inativos";

/**
 * As pessoas da igreja inteira — a tela que faltava.
 *
 * Até aqui só dava para ver gente de dentro de um ministério, então quem entrou
 * por convite e ainda não foi para nenhum era invisível. Pior: a mensagem de
 * erro da exclusão de conta manda "promova outra pessoa a administrador" e não
 * havia nenhum lugar no app onde isso pudesse ser feito.
 *
 * Só administrador chega aqui: é ele quem decide quem administra a igreja.
 */
export function Pessoas() {
  const { perfil } = useAuth();
  const souAdmin = perfil?.papelGlobal === "admin";

  const [pessoas, setPessoas] = useState<PessoaDaIgreja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("ativos");
  const [confirmacao, setConfirmacao] = useState<{
    titulo: string;
    descricao: string;
    rotulo: string;
    executar: () => Promise<void>;
  } | null>(null);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setErro(null);
    try {
      setPessoas(await listarPessoasDaIgreja(supabase));
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar as pessoas da igreja."));
    } finally {
      setCarregando(false);
    }
  }, [perfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ativos = useMemo(() => pessoas.filter((pessoa) => pessoa.ativo), [pessoas]);
  const inativos = useMemo(() => pessoas.filter((pessoa) => !pessoa.ativo), [pessoas]);
  const visiveis = aba === "ativos" ? ativos : inativos;
  const administradores = ativos.filter((pessoa) => pessoa.papelGlobal === "admin");

  async function executar(acao: () => Promise<void>, alternativa: string) {
    setErro(null);
    try {
      await acao();
      await carregar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, alternativa));
    }
  }

  function acoesDaPessoa(pessoa: PessoaDaIgreja): AcaoDoMenu[] {
    const souEu = pessoa.id === perfil?.id;
    const ehUnicoAdmin = pessoa.papelGlobal === "admin" && administradores.length === 1;
    const acoes: AcaoDoMenu[] = [];

    if (pessoa.ativo) {
      if (pessoa.papelGlobal === "admin") {
        acoes.push({
          rotulo: "Deixar de ser administrador",
          icone: <ShieldMinus aria-hidden className="size-4" />,
          desabilitada: ehUnicoAdmin,
          detalhe: ehUnicoAdmin
            ? "É o único administrador da igreja. Promova outra pessoa antes."
            : souEu
              ? "Você perde o acesso de administrador na hora."
              : undefined,
          aoEscolher: () =>
            setConfirmacao({
              titulo: souEu ? "Deixar de administrar a igreja?" : `Rebaixar ${pessoa.nome}?`,
              descricao: souEu
                ? "Você continua na igreja e nos seus ministérios, mas deixa de criar ministérios, gerar convites de líder e promover outras pessoas. Só outro administrador poderá devolver isso."
                : `${pessoa.nome} continua na igreja e nos ministérios dela, mas deixa de administrar.`,
              rotulo: "Rebaixar",
              executar: () => definirPapelGlobal(supabase, pessoa.id, "membro"),
            }),
        });
      } else {
        acoes.push({
          rotulo: "Tornar administrador",
          icone: <ShieldCheck aria-hidden className="size-4" />,
          aoEscolher: () =>
            setConfirmacao({
              titulo: `Tornar ${pessoa.nome} administrador?`,
              descricao:
                "Administrador enxerga todos os ministérios, cria e arquiva ministérios e eventos, e pode promover outras pessoas — inclusive rebaixar você. Dá para desfazer depois.",
              rotulo: "Tornar administrador",
              executar: () => definirPapelGlobal(supabase, pessoa.id, "admin"),
            }),
        });
      }

      // Liderança de ministério é outro papel: mora em `membros_ministerio`.
      // Aparece aqui para não obrigar a abrir cada ministério só para promover.
      for (const vinculo of pessoa.ministerios) {
        const ehLider = vinculo.papel === "lider";
        acoes.push({
          rotulo: ehLider
            ? `Tirar a liderança de ${vinculo.ministerioNome}`
            : `Tornar líder de ${vinculo.ministerioNome}`,
          icone: <Crown aria-hidden className="size-4" />,
          aoEscolher: () =>
            void executar(
              () => definirPapelDoMembro(supabase, vinculo.vinculoId, ehLider ? "membro" : "lider"),
              "Não foi possível alterar a liderança.",
            ),
        });
      }

      if (!souEu) {
        acoes.push({
          rotulo: "Desativar pessoa",
          icone: <UserRoundX aria-hidden className="size-4" />,
          tom: "perigo",
          desabilitada: ehUnicoAdmin,
          detalhe: ehUnicoAdmin ? "É o único administrador da igreja." : undefined,
          aoEscolher: () =>
            setConfirmacao({
              titulo: `Desativar ${pessoa.nome}?`,
              descricao:
                "A pessoa some das listas e deixa de ser escalada, mas o histórico dela continua contando certo no relatório. Dá para reativar depois. A conta em si continua existindo — só quem é dono dela pode excluí-la.",
              rotulo: "Desativar",
              executar: () => definirPerfilAtivo(supabase, pessoa.id, false),
            }),
        });
      }
    } else {
      acoes.push({
        rotulo: "Reativar pessoa",
        icone: <UserCheck aria-hidden className="size-4" />,
        aoEscolher: () =>
          void executar(
            () => definirPerfilAtivo(supabase, pessoa.id, true),
            "Não foi possível reativar a pessoa.",
          ),
      });
    }

    return acoes;
  }

  if (!souAdmin) {
    return (
      <Layout>
        <EstadoVazio
          icone={<Users aria-hidden className="size-6" />}
          titulo="Tela do administrador"
          descricao="Quem administra a igreja é quem gerencia as pessoas dela. Você pode ver a sua equipe pela página de cada ministério."
          acao={<BotaoLink variante="primario" to="/ministerios">Ver ministérios</BotaoLink>}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <TituloPagina descricao="Todo mundo que já entrou na igreja pelo app, mesmo quem ainda não está em nenhum ministério.">
        Pessoas
      </TituloPagina>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      {inativos.length > 0 && (
        <Alternador
          className="mt-5"
          rotulo="Mostrar pessoas"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "ativos", rotulo: "Na igreja", contagem: ativos.length },
            { valor: "inativos", rotulo: "Desativadas", contagem: inativos.length },
          ]}
        />
      )}

      <div className="mt-5">
        {carregando ? (
          <EsqueletoLista linhas={3} />
        ) : visiveis.length === 0 ? (
          <EstadoVazio
            icone={<Users aria-hidden className="size-6" />}
            titulo={aba === "inativos" ? "Ninguém desativado" : "Só você por enquanto"}
            descricao={
              aba === "inativos"
                ? "Pessoas desativadas aparecem aqui e podem voltar quando você quiser."
                : "Gere um código de convite na página de um ministério e mande para a sua equipe."
            }
            acao={aba === "ativos" && <BotaoLink to="/ministerios">Ir para os ministérios</BotaoLink>}
          />
        ) : (
          <motion.ul variants={listaEmCascata} initial="oculto" animate="visivel" className="space-y-3">
            <AnimatePresence initial={false}>
              {visiveis.map((pessoa) => (
                <motion.li
                  key={pessoa.id}
                  variants={itemDaLista}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  layout
                >
                  <Card>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-texto">{pessoa.nome}</p>
                          {pessoa.papelGlobal === "admin" && (
                            <Badge tom="marca" icone={<ShieldCheck aria-hidden className="size-3.5" />}>
                              Administrador
                            </Badge>
                          )}
                          {pessoa.id === perfil?.id && <Badge tom="neutro">Você</Badge>}
                          {!pessoa.ativo && <Badge tom="atencao">Desativada</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-texto-suave">{pessoa.email}</p>

                        {pessoa.ministerios.length === 0 ? (
                          <p className="mt-2 text-sm text-texto-suave">
                            Ainda não está em nenhum ministério.
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {pessoa.ministerios.map((vinculo) => (
                              <Link
                                key={vinculo.vinculoId}
                                to={`/ministerios/${vinculo.ministerioId}`}
                                className="inline-flex items-center gap-1 rounded-full border border-borda bg-superficie-suave px-2.5 py-1 text-xs font-medium text-texto-suave transition hover:border-borda-forte hover:text-texto"
                              >
                                {vinculo.papel === "lider" && (
                                  <Crown aria-hidden className="size-3 text-marca-700" />
                                )}
                                {vinculo.ministerioNome}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>

                      <MenuAcoes rotulo={`Ações de ${pessoa.nome}`} acoes={acoesDaPessoa(pessoa)} />
                    </div>
                  </Card>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <ConfirmarAcao
        aberto={confirmacao !== null}
        aoFechar={() => setConfirmacao(null)}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        rotuloConfirmar={confirmacao?.rotulo ?? "Confirmar"}
        variante="primario"
        aoConfirmar={async () => {
          if (!confirmacao) return;
          await confirmacao.executar();
          await carregar();
        }}
      />
    </Layout>
  );
}
