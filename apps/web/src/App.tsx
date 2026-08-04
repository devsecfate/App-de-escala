import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequerPerfil } from "./components/RequerPerfil";
import { TelaCarregando } from "./components/TelaCarregando";

/**
 * Só duas telas nascem dentro do pacote principal: a de entrar e a Home.
 *
 * São as únicas por onde todo mundo passa — a maior parte da igreja abre o app,
 * olha a próxima escala, confirma presença e fecha. Tudo o mais (as telas do
 * líder, o cadastro, a conta) chega por `import()` quando a pessoa realmente
 * for até lá. Com o tema, o `motion` e os ícones, o pacote único tinha passado
 * dos 600 KB que a Etapa 6 pôs como teto.
 *
 * Não atrapalha o offline: os pedaços são `.js` no `dist/`, e o precache do
 * service worker leva todos eles (globPatterns em vite.config.ts) — quem
 * instalou o app tem os arquivos antes de precisar.
 */
const Cadastrar = lazy(() =>
  import("./pages/Cadastrar").then((modulo) => ({ default: modulo.Cadastrar })),
);
const RedefinirSenha = lazy(() =>
  import("./pages/RedefinirSenha").then((modulo) => ({ default: modulo.RedefinirSenha })),
);
const Onboarding = lazy(() =>
  import("./pages/Onboarding").then((modulo) => ({ default: modulo.Onboarding })),
);
const NaoEncontrado = lazy(() =>
  import("./pages/NaoEncontrado").then((modulo) => ({ default: modulo.NaoEncontrado })),
);
const Ministerios = lazy(() =>
  import("./pages/Ministerios").then((modulo) => ({ default: modulo.Ministerios })),
);
const Eventos = lazy(() =>
  import("./pages/Eventos").then((modulo) => ({ default: modulo.Eventos })),
);
const Disponibilidade = lazy(() =>
  import("./pages/Disponibilidade").then((modulo) => ({ default: modulo.Disponibilidade })),
);
const Conta = lazy(() => import("./pages/Conta").then((modulo) => ({ default: modulo.Conta })));
const MinisterioDetalhe = lazy(() =>
  import("./pages/MinisterioDetalhe").then((modulo) => ({ default: modulo.MinisterioDetalhe })),
);
const MontarEscala = lazy(() =>
  import("./pages/MontarEscala").then((modulo) => ({ default: modulo.MontarEscala })),
);
const Repertorio = lazy(() =>
  import("./pages/Repertorio").then((modulo) => ({ default: modulo.Repertorio })),
);
const Relatorio = lazy(() =>
  import("./pages/Relatorio").then((modulo) => ({ default: modulo.Relatorio })),
);

export default function App() {
  return (
    <Suspense fallback={<TelaCarregando />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastrar" element={<Cadastrar />} />
        {/* Sem ProtectedRoute: a tela atende os dois casos — sem sessão pede o
            e-mail, e com a sessão de recuperação (vinda do link) pede a senha. */}
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <RequerPerfil>
              <Home />
            </RequerPerfil>
          }
        />
        <Route
          path="/ministerios"
          element={
            <RequerPerfil>
              <Ministerios />
            </RequerPerfil>
          }
        />
        <Route
          path="/ministerios/:id"
          element={
            <RequerPerfil>
              <MinisterioDetalhe />
            </RequerPerfil>
          }
        />
        <Route
          path="/eventos"
          element={
            <RequerPerfil>
              <Eventos />
            </RequerPerfil>
          }
        />
        <Route
          path="/eventos/:eventoId/ministerios/:ministerioId/escala"
          element={
            <RequerPerfil>
              <MontarEscala />
            </RequerPerfil>
          }
        />
        <Route
          path="/ministerios/:id/repertorio"
          element={
            <RequerPerfil>
              <Repertorio />
            </RequerPerfil>
          }
        />
        <Route
          path="/ministerios/:id/relatorio"
          element={
            <RequerPerfil>
              <Relatorio />
            </RequerPerfil>
          }
        />
        <Route
          path="/conta"
          element={
            <RequerPerfil>
              <Conta />
            </RequerPerfil>
          }
        />
        <Route
          path="/disponibilidade"
          element={
            <RequerPerfil>
              <Disponibilidade />
            </RequerPerfil>
          }
        />
        <Route path="*" element={<NaoEncontrado />} />
      </Routes>
    </Suspense>
  );
}
