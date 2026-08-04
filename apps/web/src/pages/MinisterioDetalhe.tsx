import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Music } from "lucide-react";
import {
  listarFuncoes,
  listarMembrosDoMinisterio,
  listarPerfisDaIgreja,
  obterIgreja,
  obterMinisterio,
  obterRegrasMinisterio,
  type Funcao,
  type Igreja,
  type MembroMinisterioComPerfil,
  type Ministerio,
  type Perfil,
  type RegraMinisterio,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { Alerta, Badge, BotaoLink, EsqueletoLista, EstadoVazio, TituloPagina } from "../components/ui";
import { SecaoPessoas } from "../components/ministerio/SecaoPessoas";
import { SecaoFuncoes } from "../components/ministerio/SecaoFuncoes";
import { SecaoConvites } from "../components/ministerio/SecaoConvites";
import { SecaoRegras } from "../components/ministerio/SecaoRegras";
import { mensagemDeErro } from "../lib/erros-auth";

export function MinisterioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { perfil } = useAuth();

  const [ministerio, setMinisterio] = useState<Ministerio | null>(null);
  const [igreja, setIgreja] = useState<Igreja | null>(null);
  const [membros, setMembros] = useState<MembroMinisterioComPerfil[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [perfisDaIgreja, setPerfisDaIgreja] = useState<Perfil[]>([]);
  const [regras, setRegras] = useState<RegraMinisterio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id || !perfil) return;
    setErro(null);
    try {
      const [ministerioCarregado, membrosCarregados, funcoesCarregadas, regrasCarregadas, igrejaCarregada] =
        await Promise.all([
          obterMinisterio(supabase, id),
          listarMembrosDoMinisterio(supabase, id),
          // Inclui as arquivadas: a seção de funções tem a aba para desarquivar.
          listarFuncoes(supabase, id, true),
          obterRegrasMinisterio(supabase, id),
          obterIgreja(supabase, perfil.igrejaId),
        ]);
      setMinisterio(ministerioCarregado);
      setMembros(membrosCarregados);
      setFuncoes(funcoesCarregadas);
      setRegras(regrasCarregadas);
      setIgreja(igrejaCarregada);
      setPerfisDaIgreja(await listarPerfisDaIgreja(supabase, perfil.igrejaId));
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar o ministério."));
    } finally {
      setCarregando(false);
    }
  }, [id, perfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const souLider = useMemo(() => {
    if (!perfil) return false;
    if (perfil.papelGlobal === "admin") return true;
    return membros.some((membro) => membro.perfilId === perfil.id && membro.papel === "lider");
  }, [perfil, membros]);

  if (carregando) {
    return (
      <Layout>
        <EsqueletoLista linhas={4} />
      </Layout>
    );
  }

  if (!ministerio) {
    return (
      <Layout>
        <EstadoVazio
          titulo="Ministério não encontrado"
          descricao="Ele pode ter sido excluído, ou você não faz parte dele."
          acao={
            <BotaoLink to="/ministerios" icone={<ArrowLeft aria-hidden className="size-4" />}>
              Voltar para os ministérios
            </BotaoLink>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <Link
        to="/ministerios"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-texto-suave transition hover:text-texto"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Ministérios
      </Link>

      <TituloPagina
        descricao={ministerio.descricao ?? undefined}
        acoes={
          <>
            {souLider && (
              <BotaoLink
                tamanho="pequeno"
                to={`/ministerios/${ministerio.id}/relatorio`}
                icone={<BarChart3 aria-hidden className="size-4" />}
              >
                Relatório
              </BotaoLink>
            )}
            <BotaoLink
              tamanho="pequeno"
              to={`/ministerios/${ministerio.id}/repertorio`}
              icone={<Music aria-hidden className="size-4" />}
            >
              Repertório
            </BotaoLink>
          </>
        }
      >
        {ministerio.nome}
      </TituloPagina>

      {!ministerio.ativo && (
        <Alerta className="mt-4" tipo="aviso" titulo="Ministério arquivado">
          Ele não aparece nas listas do dia a dia. Um administrador pode desarquivar na tela de ministérios.
        </Alerta>
      )}

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      {!souLider && (
        <div className="mt-4">
          <Badge tom="neutro">Você é membro deste ministério</Badge>
        </div>
      )}

      <div className="mt-6 space-y-8">
        <SecaoPessoas
          membros={membros}
          perfisDaIgreja={perfisDaIgreja}
          souLider={souLider}
          meuPerfilId={perfil?.id ?? ""}
          ministerioId={ministerio.id}
          aoMudar={carregar}
        />

        <SecaoConvites
          ministerioId={ministerio.id}
          ministerioNome={ministerio.nome}
          igrejaNome={igreja?.nome}
          souLider={souLider}
        />

        <SecaoFuncoes
          funcoes={funcoes}
          souLider={souLider}
          ministerioId={ministerio.id}
          aoMudar={carregar}
        />

        {souLider && <SecaoRegras ministerioId={ministerio.id} regras={regras} aoSalvar={carregar} />}
      </div>
    </Layout>
  );
}
