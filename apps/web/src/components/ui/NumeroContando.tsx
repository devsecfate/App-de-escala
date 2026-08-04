import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { usaMovimentoReduzido } from "../../lib/movimento";

/**
 * Número que sobe de zero até o valor.
 *
 * Não é enfeite: o relatório é uma parede de números e a contagem dá ao olho um
 * instante para perceber quais deles são grandes antes de ler cada um. Quem
 * pediu menos movimento no sistema recebe o número parado, direto.
 */
export function NumeroContando({
  valor,
  decimais = 0,
  className,
}: {
  valor: number;
  decimais?: number;
  className?: string;
}) {
  const semMovimento = usaMovimentoReduzido();
  const bruto = useMotionValue(semMovimento ? valor : 0);
  const texto = useTransform(bruto, (atual) =>
    atual.toFixed(decimais).replace(".", ","),
  );

  useEffect(() => {
    if (semMovimento) {
      bruto.set(valor);
      return;
    }
    const controles = animate(bruto, valor, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
    return () => controles.stop();
  }, [valor, semMovimento, bruto]);

  return (
    <motion.span className={className} aria-hidden>
      {texto}
    </motion.span>
  );
}
