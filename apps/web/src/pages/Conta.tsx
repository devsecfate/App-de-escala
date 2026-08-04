import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Church, LogOut, ShieldCheck, User } from "lucide-react";
import {
  atualizarIgreja,
  atualizarPerfil,
  obterIgreja,
  type Igreja,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { Alerta, Badge, Botao, Campo, CampoSelect, Card, Esqueleto, Secao, TituloPagina } from "../components/ui";
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
      </div>
    </Layout>
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
