import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  aplicarTema,
  guardarPreferencia,
  lerPreferencia,
  ouvirTemaDoSistema,
  resolverTema,
  type PreferenciaDeTema,
  type TemaAplicado,
} from "../lib/tema";

interface TemaContextValue {
  /** O que a pessoa escolheu: pode ser "sistema". */
  preferencia: PreferenciaDeTema;
  /** O que está valendo agora: sempre "claro" ou "escuro". */
  tema: TemaAplicado;
  definirPreferencia: (nova: PreferenciaDeTema) => void;
}

const TemaContext = createContext<TemaContextValue | undefined>(undefined);

export function TemaProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<PreferenciaDeTema>(lerPreferencia);
  const [tema, setTema] = useState<TemaAplicado>(() => resolverTema(lerPreferencia()));

  const definirPreferencia = useCallback((nova: PreferenciaDeTema) => {
    setPreferencia(nova);
    guardarPreferencia(nova);
    setTema(aplicarTema(nova));
  }, []);

  useEffect(() => {
    // Quem fixou claro ou escuro não pode ver o tema virar sozinho quando o
    // celular entra no modo noturno — só quem pediu para seguir o sistema.
    if (preferencia !== "sistema") return;
    return ouvirTemaDoSistema(() => setTema(aplicarTema("sistema")));
  }, [preferencia]);

  return (
    <TemaContext.Provider value={{ preferencia, tema, definirPreferencia }}>
      {children}
    </TemaContext.Provider>
  );
}

export function useTema(): TemaContextValue {
  const context = useContext(TemaContext);
  if (!context) {
    throw new Error("useTema precisa ser usado dentro de <TemaProvider>.");
  }
  return context;
}
