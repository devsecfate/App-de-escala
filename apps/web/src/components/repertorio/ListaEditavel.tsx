import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alerta, Botao, Campo, Card, ConfirmarAcao, MenuAcoes, Modal } from "../ui";
import { itemDaLista, listaEmCascata } from "../../lib/movimento";
import { mensagemDeErro } from "../../lib/erros-auth";

export interface ItemEditavel {
  id: string;
  rotulo: string;
}

/**
 * Lista curta de nomes que o líder cria, renomeia e apaga — serve tanto às
 * categorias de música quanto às colunas do repertório.
 *
 * Antes as duas eram chips com um "×" de 12px do lado: alvo impossível de
 * acertar no celular, sem confirmação nenhuma, e sem qualquer jeito de
 * renomear. Errou ao digitar "Comunhão", era criar outra e apagar a primeira.
 */
export function ListaEditavel({
  titulo,
  descricao,
  itens,
  rotuloDoItem,
  placeholder,
  aoCriar,
  aoRenomear,
  aoExcluir,
  avisoDeExclusao,
}: {
  titulo: string;
  descricao?: string;
  itens: ItemEditavel[];
  /** "categoria", "coluna" — entra nas frases dos diálogos. */
  rotuloDoItem: string;
  placeholder?: string;
  aoCriar: (rotulo: string) => Promise<void>;
  aoRenomear: (id: string, rotulo: string) => Promise<void>;
  aoExcluir: (id: string) => Promise<void>;
  /** Frase extra na confirmação, quando apagar tem consequência. */
  avisoDeExclusao?: string;
}) {
  const [novo, setNovo] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<ItemEditavel | null>(null);
  const [excluindo, setExcluindo] = useState<ItemEditavel | null>(null);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (!novo.trim()) return;
    setCriando(true);
    setErro(null);
    try {
      await aoCriar(novo.trim());
      setNovo("");
    } catch (problema) {
      setErro(mensagemDeErro(problema, `Não foi possível criar a ${rotuloDoItem}.`));
    } finally {
      setCriando(false);
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-texto">{titulo}</h3>
      {descricao && <p className="mt-1 text-sm text-texto-suave">{descricao}</p>}

      {erro && (
        <Alerta className="mt-3" tipo="erro">
          {erro}
        </Alerta>
      )}

      {itens.length === 0 ? (
        <p className="mt-3 text-sm text-texto-suave">Nenhuma cadastrada ainda.</p>
      ) : (
        <motion.ul
          variants={listaEmCascata}
          initial="oculto"
          animate="visivel"
          className="mt-3 divide-y divide-borda rounded-xl border border-borda"
        >
          <AnimatePresence initial={false}>
            {itens.map((item) => (
              <motion.li
                key={item.id}
                variants={itemDaLista}
                exit={{ opacity: 0, height: 0 }}
                layout
                className="flex items-center justify-between gap-2 py-1 pl-3 pr-1"
              >
                <span className="min-w-0 truncate py-2 text-sm font-medium text-texto">{item.rotulo}</span>
                <MenuAcoes
                  rotulo={`Ações de ${item.rotulo}`}
                  acoes={[
                    {
                      rotulo: "Renomear",
                      icone: <Pencil aria-hidden className="size-4" />,
                      aoEscolher: () => setRenomeando(item),
                    },
                    {
                      rotulo: "Excluir",
                      icone: <Trash2 aria-hidden className="size-4" />,
                      tom: "perigo",
                      aoEscolher: () => setExcluindo(item),
                    },
                  ]}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <form onSubmit={criar} className="mt-3 flex items-end gap-2">
        <Campo
          rotulo={`Nova ${rotuloDoItem}`}
          rotuloOculto
          classeContainer="flex-1"
          placeholder={placeholder ?? `Nova ${rotuloDoItem}`}
          value={novo}
          onChange={(evento) => setNovo(evento.target.value)}
        />
        <Botao
          type="submit"
          variante="secundario"
          icone={<Plus aria-hidden className="size-4" />}
          carregando={criando}
          disabled={!novo.trim()}
        >
          Criar
        </Botao>
      </form>

      <RenomearModal
        alvo={renomeando}
        rotuloDoItem={rotuloDoItem}
        aoFechar={() => setRenomeando(null)}
        aoSalvar={aoRenomear}
      />

      <ConfirmarAcao
        aberto={excluindo !== null}
        aoFechar={() => setExcluindo(null)}
        titulo={`Excluir “${excluindo?.rotulo ?? ""}”?`}
        descricao={avisoDeExclusao}
        rotuloConfirmar="Excluir"
        aoConfirmar={async () => {
          if (excluindo) await aoExcluir(excluindo.id);
        }}
      />
    </Card>
  );
}

function RenomearModal({
  alvo,
  rotuloDoItem,
  aoFechar,
  aoSalvar,
}: {
  alvo: ItemEditavel | null;
  rotuloDoItem: string;
  aoFechar: () => void;
  aoSalvar: (id: string, rotulo: string) => Promise<void>;
}) {
  const [rotulo, setRotulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!alvo) return;
    setRotulo(alvo.rotulo);
    setErro(null);
  }, [alvo]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!alvo || !rotulo.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(alvo.id, rotulo.trim());
      aoFechar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível renomear."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={alvo !== null} aoFechar={aoFechar} titulo={`Renomear ${rotuloDoItem}`}>
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        <Campo
          rotulo="Nome"
          value={rotulo}
          onChange={(evento) => setRotulo(evento.target.value)}
          autoFocus
          required
        />
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando} disabled={!rotulo.trim()}>
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
