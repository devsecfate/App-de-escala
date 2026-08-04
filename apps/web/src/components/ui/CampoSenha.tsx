import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Campo, type CampoProps } from "./Campo";

/**
 * Campo de senha com o olho de mostrar/ocultar.
 *
 * Não é enfeite: digitar senha em teclado de celular, às escuras, na igreja, é
 * a principal causa de "minha senha não funciona". Ver o que se digitou custa
 * um toque e resolve a maior parte dos casos.
 */
type CampoSenhaProps = Omit<CampoProps, "type" | "sufixo" | "rotulo"> & { rotulo?: string };

export function CampoSenha({ rotulo = "Senha", ...resto }: CampoSenhaProps) {
  const [visivel, setVisivel] = useState(false);
  const Icone = visivel ? EyeOff : Eye;

  return (
    <Campo
      rotulo={rotulo}
      type={visivel ? "text" : "password"}
      sufixo={
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          className="flex size-10 items-center justify-center rounded-lg text-texto-suave transition hover:bg-superficie-suave hover:text-texto"
        >
          <Icone aria-hidden className="size-4.5" />
        </button>
      }
      {...resto}
    />
  );
}
