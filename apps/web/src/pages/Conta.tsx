import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Church, LogOut, ShieldCheck, Trash2, TriangleAlert, User } from "lucide-react";
import {
  atualizarIgreja,
  atualizarPerfil,
  contarMeuHistorico,
  excluirMinhaConta,
  obterIgreja,
  type Igreja,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import {
  Alerta,
  Badge,
  Botao,
  Campo,
  CampoSelect,
  Card,
  Esqueleto,
  Modal,
  Secao,
  TituloPagina,
} from "../components/ui";
import { FUSOS } from "../lib/fusos";
import { mensagemDeErro } from "../lib/erros-auth";

/**
 * Minha conta.
 *
 * Nada disso tinha tela: quem entrou por link mágico ficava com o e-mail no
 * lugar do nome para sempre, e o fuso escolhido no onboarding — que decide o
 * "amanhã" do lembrete e o "este mês" do relatório — não tinha conserto.
 */
export function Conta() {
  const { perfil, recarregarPerfil, sair } = useAuth();
  const [igreja, setIgreja] = useState<Igreja | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const souAdmin = perfil?.papelGlobal === "admin";

  const carregar = useCallback(async () => {
    if (!perfil) return;
    try {
      setIgreja(await obterIgreja(supabase, perfil.igrejaId));
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar os dados da igreja."));
    } finally {
      setCarregando(false);
    }
  }, [perfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <Layout>
      <TituloPagina descricao="Seus dados e os da igreja.">Minha conta</TituloPagina>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      <div className="mt-6 space-y-8">
        <Secao titulo="Seus dados" descricao="É este nome que os líderes veem ao montar a escala.">
          {perfil && <FormularioPerfil perfil={perfil} aoSalvar={recarregarPerfil} />}
        </Secao>

        {souAdmin && (
          <Secao
            titulo="A igreja"
            descricao="Só quem administra a igreja pode mudar isto."
          >
            {carregando ? (
              <Esqueleto className="h-40 w-full" />
            ) : igreja ? (
              <FormularioIgreja igreja={igreja} aoSalvar={carregar} />
            ) : (
              <Alerta tipo="erro">Não encontrei os dados da igreja.</Alerta>
            )}
          </Secao>
        )}

        <Secao titulo="Sessão">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-texto-suave">
                {souAdmin ? (
                  <Badge tom="marca" icone={<ShieldCheck aria-hidden className="size-3.5" />}>
                    Administra a igreja
                  </Badge>
                ) : (
                  <Badge tom="neutro" icone={<User aria-hidden className="size-3.5" />}>
                    Membro
                  </Badge>
                )}
              </div>
              <Botao
                variante="secundario"
                icone={<LogOut aria-hidden className="size-4" />}
                onClick={() => void sair()}
              >
                Sair desta conta
              </Botao>
            </div>
            <p className="mt-3 text-sm text-texto-suave">
              Sair apaga também a escala guardada para leitura offline neste aparelho — celular emprestado
              não pode mostrar a escala de quem entrou antes.
            </p>
          </Card>
        </Secao>

        <ZonaDePerigo />
      </div>
    </Layout>
  );
}

/**
 * Excluir a conta.
 *
 * Fica no fim da página, separada por borda vermelha e com o desfecho escrito
 * antes de perguntar — a mesma honestidade das outras exclusões do app. Quem
 * nunca serviu some de vez; quem já serviu perde o login e o nome fica nas
 * escalas passadas, porque é dele que o relatório precisa.
 *
 * Pede para digitar EXCLUIR porque, ao contrário de arquivar um ministério,
 * isto não tem desfazer nenhum.
 */
function ZonaDePerigo() {
  const { sair } = useAuth();
  const [historico, setHistorico] = useState<number | null>(null);
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void contarMeuHistorico(supabase)
      .then((total) => {
        if (!cancelado) setHistorico(total);
      })
      .catch(() => {
        // Não vale bloquear a tela por causa disto: sem o número, a confirmação
        // usa a redação genérica, que continua verdadeira nos dois casos.
        if (!cancelado) setHistorico(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const podeConfirmar = confirmacao.trim().toUpperCase() === "EXCLUIR";

  async function excluir(evento: FormEvent) {
    evento.preventDefault();
    if (!podeConfirmar) return;
    setExcluindo(true);
    setErro(null);
    try {
      await excluirMinhaConta(supabase);
      // A sessão do navegador continua em pé com um token que já não
      // corresponde a ninguém; `sair` também limpa o cache offline.
      await sair();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível excluir a conta."));
      setExcluindo(false);
    }
  }

  const oQueVaiAcontecer =
    historico === null
      ? "Se você nunca serviu em nenhuma escala, seus dados somem por completo. Se já serviu, seu nome continua nas escalas passadas (o relatório da igreja depende disso) e todo o resto é apagado."
      : historico === 0
        ? "Você nunca serviu em nenhuma escala, então seus dados somem por completo — não fica rastro."
        : `Você já aparece em ${historico} ${historico === 1 ? "escala" : "escalas"}. Seu nome continua nelas, porque é dele que o relatório da igreja precisa para dizer quem serviu. Todo o resto — telefone, e-mail, ministérios e avisos no celular — é apagado.`;

  return (
    <Secao titulo="Excluir minha conta">
      <Card className="border-perigo/40 bg-perigo-suave/40">
        <div className="flex items-start gap-3">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-perigo" />
          <div className="min-w-0">
            <p className="font-semibold text-texto">Isto não tem volta</p>
            <p className="mt-1 text-sm text-texto-suave">{oQueVaiAcontecer}</p>
            <p className="mt-2 text-sm text-texto-suave">
              Em qualquer um dos casos você deixa de conseguir entrar no app.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Botao
            variante="perigo"
            icone={<Trash2 aria-hidden className="size-4" />}
            onClick={() => {
              setConfirmacao("");
              setErro(null);
              setAberto(true);
            }}
          >
            Excluir minha conta
          </Botao>
        </div>
      </Card>

      <Modal
        aberto={aberto}
        aoFechar={() => {
          if (!excluindo) setAberto(false);
        }}
        titulo="Excluir sua conta?"
        descricao={oQueVaiAcontecer}
      >
        <form onSubmit={excluir} className="space-y-4">
          {erro && <Alerta tipo="erro">{erro}</Alerta>}

          <Campo
            rotulo="Para confirmar, digite EXCLUIR"
            value={confirmacao}
            onChange={(evento) => setConfirmacao(evento.target.value)}
            placeholder="EXCLUIR"
            autoComplete="off"
            autoFocus
          />

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={excluindo}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" carregando={excluindo} disabled={!podeConfirmar}>
              Excluir para sempre
            </Botao>
          </div>
        </form>
      </Modal>
    </Secao>
  );
}

function FormularioPerfil({
  perfil,
  aoSalvar,
}: {
  perfil: { id: string; nome: string; telefone: string | null; email: string };
  aoSalvar: () => Promise<void>;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(perfil.telefone ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await atualizarPerfil(supabase, perfil.id, {
        nome: nome.trim(),
        telefone: telefone.trim() || null,
      });
      await aoSalvar();
      setSalvo(true);
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar seus dados."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        {salvo && !erro && <Alerta tipo="sucesso">Dados salvos.</Alerta>}

        <Campo
          rotulo="Nome"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          required
        />
        <Campo
          rotulo="Telefone"
          type="tel"
          dica="Opcional. Ajuda o líder a falar com você fora do app."
          value={telefone}
          onChange={(evento) => setTelefone(evento.target.value)}
        />
        <Campo
          rotulo="E-mail"
          value={perfil.email}
          disabled
          dica="Este é o e-mail com que você entra. Para trocar, fale com quem administra a igreja."
        />

        <div className="flex justify-end">
          <Botao type="submit" carregando={salvando} disabled={!nome.trim()}>
            Salvar
          </Botao>
        </div>
      </form>
    </Card>
  );
}

function FormularioIgreja({ igreja, aoSalvar }: { igreja: Igreja; aoSalvar: () => Promise<void> }) {
  const [nome, setNome] = useState(igreja.nome);
  const [fusoHorario, setFusoHorario] = useState(igreja.fusoHorario);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const fusoMudou = fusoHorario !== igreja.fusoHorario;

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await atualizarIgreja(supabase, igreja.id, { nome: nome.trim(), fusoHorario });
      await aoSalvar();
      setSalvo(true);
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar os dados da igreja."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        {salvo && !erro && <Alerta tipo="sucesso">Dados da igreja salvos.</Alerta>}

        <Campo
          rotulo="Nome da igreja"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          required
        />

        <CampoSelect
          rotulo="Fuso horário"
          value={fusoHorario}
          onChange={(evento) => setFusoHorario(evento.target.value)}
        >
          {FUSOS.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </CampoSelect>

        {fusoMudou && (
          <Alerta tipo="aviso" titulo="O fuso muda mais do que parece">
            É ele que define o que é “amanhã” para o lembrete de véspera e o que é “este mês” para o
            relatório. Os números do relatório podem mudar depois de salvar.
          </Alerta>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm text-texto-suave">
            <Church aria-hidden className="size-4" />
            Vale para todo mundo da igreja.
          </p>
          <Botao type="submit" carregando={salvando} disabled={!nome.trim()}>
            Salvar
          </Botao>
        </div>
      </form>
    </Card>
  );
}
