import { useEffect, useState } from 'react';

/**
 * Segura a exibição de um indicador de carregamento por `delayMs`.
 * Esperas curtas terminam antes do prazo e não chegam a piscar na tela.
 */
export function useDelayedVisible(active: boolean, delayMs = 300): boolean {
  const [elapsed, setElapsed] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  // Ajuste durante a renderização: reinicia a contagem a cada nova espera.
  if (wasActive !== active) {
    setWasActive(active);
    if (active) setElapsed(false);
  }

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => setElapsed(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [active, delayMs]);

  return active && elapsed;
}
