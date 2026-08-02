import { Route, Routes } from "react-router-dom";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Home } from "./pages/Home";
import { Ministerios } from "./pages/Ministerios";
import { MinisterioDetalhe } from "./pages/MinisterioDetalhe";
import { Eventos } from "./pages/Eventos";
import { MontarEscala } from "./pages/MontarEscala";
import { Disponibilidade } from "./pages/Disponibilidade";
import { Repertorio } from "./pages/Repertorio";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequerPerfil } from "./components/RequerPerfil";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        path="/disponibilidade"
        element={
          <RequerPerfil>
            <Disponibilidade />
          </RequerPerfil>
        }
      />
    </Routes>
  );
}
