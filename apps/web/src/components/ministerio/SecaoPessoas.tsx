import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Crown, ShieldMinus, UserMinus, UserPlus, Users } from "lucide-react";
import {
  adicionarMembroExistente,
  definirPapelDoMembro,
  removerMembro,
  type MembroMinisterioComPerfil,
  type PapelMinisterio,
  type Perfil,
} from "@escala-app/core";
import { supabase } from "../../lib/supabase";
import {
  Alerta,
  Badge,
  Botao,
  CampoSelect,
  ConfirmarAcao,
  EstadoVazio,
  MenuAcoes,
  Modal,
  Secao,
} from "../ui";
import { itemDaLista, listaEmCascata } from "../../lib/movimento";
import { mensagemDeErro } from "../../lib/erros-auth";

export function SecaoPessoas({
  membros,
  perfisDaIgreja,
  souLider,
  meuPerfilId,
  aoMudar,
  ministerioId,
}: {
  membros: MembroMinisterioComPerfil[];
  perfisDaIgreja: Perfil[];
  souLider: boolean;
  meuPerfilId: string;
  ministerioId: string;
  aoMudar: () => Promise<void>;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [remocao, setRemocao] = useState<MembroMinisterioComPerfil | null>(null);

  const disponiveis = perfisDaIgreja.filter(
    (perfil) => !membros.some((membro) => membro.perfilId === perfil.id),
  );
  const lideres = membros.filter((membro) => membro.papel === "lider");

  async function alterarPapel(membro: MembroMinisterioComPerfil, papel: PapelMinisterio) {
    setErro(null);
    try {
      await definirPapelDoMembro(supabase, membro.id, papel);
      await aoMudar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível alterar o papel."));
    }
  }

  async function confirmarRemocao() {
    if (!remocao) return;
    await removerMembro(supabase, remocao.id);
    await aoMudar();
  }

  return (
    <Secao
      titulo="Pessoas"
      descricao="Quem pode ser escalado neste ministério."
      acoes={
        souLider &&
        disponiveis.length > 0 && (
          <Botao
            tamanho="pequeno"
            variante="secundario"
            icone={<UserPlus aria-hidden className="size-4" />}
            onClick={() => setAdicionando(true)}
          >
            Adicionar
          </Botao>
        )
      }
    >
      {erro && (
        <Alerta className="mb-3" tipo="erro">
          {erro}
        </Alerta>
      )}

      {membros.length === 0 ? (
        <EstadoVazio
          icone={<Users aria-hidden className="size-6" />}
          titulo="Ninguém aqui ainda"
          descricao="Adicione quem já tem conta na igreja, ou gere um código de convite logo abaixo."
        />
      ) : (
        <motion.ul
          variants={listaEmCascata}
          initial="oculto"
          animate="visivel"
          className="divide-y divide-borda overflow-hidden rounded-cartao border border-borda bg-superficie shadow-cartao"
        >
          <AnimatePresence initial={false}>
            {membros.map((membro) => {
              const ehUnicoLider = membro.papel === "lider" && lideres.length === 1;
              return (
                <motion.li
                  key={membro.id}
                  variants={itemDaLista}
                  exit={{ opacity: 0, height: 0 }}
                  layout
                  className="flex items-center justify-between gap-2 py-1 pl-4 pr-2"
                >
                  <div className="min-w-0 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-texto">{membro.nome}</span>
                      {membro.papel === "lider" && (
                        <Badge tom="marca" icone={<Crown aria-hidden className="size-3.5" />}>
                          Líder
                        </Badge>
                      )}
                      {membro.perfilId === meuPerfilId && <Badge tom="neutro">Você</Badge>}
                    </div>
                    <p className="truncate text-sm text-texto-suave">{membro.email}</p>
                  </div>

                  {souLider && (
                    <MenuAcoes
                      rotulo={`Ações de ${membro.nome}`}
                      acoes={[
                        membro.papel === "lider"
                          ? {
                              rotulo: "Tornar membro",
                              icone: <ShieldMinus aria-hidden className="size-4" />,
                              desabilitada: ehUnicoLider,
                              detalhe: ehUnicoLider
                                ? "É o único líder. Promova outra pessoa antes."
                                : undefined,
                              aoEscolher: () => void alterarPapel(membro, "membro"),
                            }
                          : {
                              rotulo: "Tornar líder",
                              icone: <Crown aria-hidden className="size-4" />,
                              aoEscolher: () => void alterarPapel(membro, "lider"),
                            },
                        {
                          rotulo: "Tirar do ministério",
                          icone: <UserMinus aria-hidden className="size-4" />,
                          tom: "perigo",
                          desabilitada: ehUnicoLider,
                          detalhe: ehUnicoLider
                            ? "O ministério ficaria sem ninguém para montar escala."
                            : undefined,
                          aoEscolher: () => setRemocao(membro),
                        },
                      ]}
                    />
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <AdicionarPessoa
        aberto={adicionando}
        disponiveis={disponiveis}
        ministerioId={ministerioId}
        aoFechar={() => setAdicionando(false)}
        aoSalvar={aoMudar}
      />

      <ConfirmarAcao
        aberto={remocao !== null}
        aoFechar={() => setRemocao(null)}
        titulo={`Tirar ${remocao?.nome ?? ""} do ministério?`}
        descricao={
          "A pessoa deixa de aparecer para ser escalada, mas continua com conta na igreja e nos outros " +
          "ministérios dela. As escalas passadas em que ela serviu não mudam."
        }
        rotuloConfirmar="Tirar do ministério"
        aoConfirmar={confirmarRemocao}
      />
    </Secao>
  );
}

function AdicionarPessoa({
  aberto,
  disponiveis,
  ministerioId,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  disponiveis: Perfil[];
  ministerioId: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [perfilId, setPerfilId] = useState("");
  const [papel, setPapel] = useState<PapelMinisterio>("membro");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!perfilId) return;
    setSalvando(true);
    setErro(null);
    try {
      await adicionarMembroExistente(supabase, ministerioId, perfilId, papel);
      await aoSalvar();
      setPerfilId("");
      setPapel("membro");
      aoFechar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível adicionar a pessoa."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Adicionar ao ministério"
      descricao="Só aparecem pessoas que já têm conta nesta igreja. Para quem ainda não tem, gere um código de convite."
    >
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <CampoSelect
          rotulo="Pessoa"
          value={perfilId}
          onChange={(evento) => setPerfilId(evento.target.value)}
          required
        >
          <option value="">Selecione...</option>
          {disponiveis.map((perfil) => (
            <option key={perfil.id} value={perfil.id}>
              {perfil.nome}
            </option>
          ))}
        </CampoSelect>

        <CampoSelect
          rotulo="Entra como"
          value={papel}
          onChange={(evento) => setPapel(evento.target.value as PapelMinisterio)}
        >
          <option value="membro">Membro — pode ser escalado</option>
          <option value="lider">Líder — monta e publica a escala</option>
        </CampoSelect>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando} disabled={!perfilId}>
            Adicionar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
