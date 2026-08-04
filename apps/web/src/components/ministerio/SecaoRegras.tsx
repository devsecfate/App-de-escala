import { useEffect, useState, type FormEvent } from "react";
import { salvarRegrasMinisterio, type RegraMinisterio } from "@escala-app/core";
import { supabase } from "../../lib/supabase";
import { Alerta, Botao, Campo, Card, Secao } from "../ui";
import { mensagemDeErro } from "../../lib/erros-auth";

/**
 * Limites que o app confere ao escalar alguém. Não impedem nada sozinhos: viram
 * avisos na tela de montar escala, e o líder decide se segue mesmo assim — a
 * exceção é o conflito entre ministérios, que ele pode transformar em bloqueio.
 */
export function SecaoRegras({
  ministerioId,
  regras,
  aoSalvar,
}: {
  ministerioId: string;
  regras: RegraMinisterio | null;
  aoSalvar: () => Promise<void>;
}) {
  const [maxEscalasMes, setMaxEscalasMes] = useState("");
  const [intervaloMinDias, setIntervaloMinDias] = useState("");
  const [bloquearConflito, setBloquearConflito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    setMaxEscalasMes(regras?.maxEscalasMes?.toString() ?? "");
    setIntervaloMinDias(regras?.intervaloMinDias?.toString() ?? "");
    setBloquearConflito(regras?.bloquearConflitoEvento ?? false);
  }, [regras]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await salvarRegrasMinisterio(supabase, ministerioId, {
        maxEscalasMes: maxEscalasMes.trim() ? Number(maxEscalasMes) : null,
        intervaloMinDias: intervaloMinDias.trim() ? Number(intervaloMinDias) : null,
        bloquearConflitoEvento: bloquearConflito,
      });
      await aoSalvar();
      setSalvo(true);
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar as regras."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Secao
      titulo="Regras da escala"
      descricao="Servem para o app avisar quando alguém está servindo demais — o líder continua decidindo."
    >
      <Card>
        <form onSubmit={salvar} className="space-y-4">
          {erro && <Alerta tipo="erro">{erro}</Alerta>}
          {salvo && !erro && <Alerta tipo="sucesso">Regras salvas.</Alerta>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Máximo de escalas por mês"
              type="number"
              min={1}
              placeholder="Sem limite"
              value={maxEscalasMes}
              dica="Deixe vazio para não limitar."
              onChange={(evento) => setMaxEscalasMes(evento.target.value)}
            />
            <Campo
              rotulo="Intervalo mínimo entre escalas (dias)"
              type="number"
              min={1}
              placeholder="Sem limite"
              value={intervaloMinDias}
              dica="Ex: 7 para ninguém servir dois domingos seguidos."
              onChange={(evento) => setIntervaloMinDias(evento.target.value)}
            />
          </div>

          <label className="flex items-start gap-2.5 text-sm text-texto">
            <input
              type="checkbox"
              checked={bloquearConflito}
              onChange={(evento) => setBloquearConflito(evento.target.checked)}
              className="mt-0.5 size-4 rounded border-borda-forte text-marca-700 focus:ring-marca-600"
            />
            <span>
              Impedir escalar quem já está em outro ministério no mesmo evento
              <span className="mt-0.5 block text-texto-suave">
                Desmarcado, o app só avisa. Marcado, não deixa salvar.
              </span>
            </span>
          </label>

          <div className="flex justify-end">
            <Botao type="submit" carregando={salvando}>
              Salvar regras
            </Botao>
          </div>
        </form>
      </Card>
    </Secao>
  );
}
