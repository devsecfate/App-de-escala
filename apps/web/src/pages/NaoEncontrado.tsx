import { Compass } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Layout } from "../components/Layout";
import { BotaoLink, EstadoVazio } from "../components/ui";

/**
 * Rota `*`. Antes, uma URL desconhecida (um link velho do WhatsApp, um typo)
 * renderizava tela branca: nenhuma rota casava e o `<Routes>` não devolvia
 * nada — sem erro no console, sem jeito de voltar.
 */
export function NaoEncontrado() {
  const { perfil } = useAuth();

  const conteudo = (
    <EstadoVazio
      icone={<Compass aria-hidden className="size-6" />}
      titulo="Esta página não existe"
      descricao="O endereço pode ter mudado, ou o link veio quebrado."
      acao={
        <BotaoLink to={perfil ? "/" : "/login"} variante="primario">
          {perfil ? "Ir para minhas escalas" : "Ir para o login"}
        </BotaoLink>
      }
    />
  );

  // Com perfil, a pessoa continua dentro do app (barra de navegação e tudo).
  // Sem perfil, não há navegação para mostrar.
  if (!perfil) {
    return (
      <AuthLayout titulo="Página não encontrada">
        {conteudo}
      </AuthLayout>
    );
  }

  return <Layout>{conteudo}</Layout>;
}
