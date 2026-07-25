import { useEffect, useState } from 'react';

/**
 * Segura a exibição de um indicador de carregamento por `delayMs`.
 * Esperas curtas terminam antes do prazo e não chegam a piscar na tela.
 */
export function useDelayedVisible(active: boolean, delayMs = 300): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    // Reinicia a contagem a cada nova espera.
    setElapsed(false);
    if (!active) return;
    const timeout = window.setTimeout(() => setElapsed(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [active, delayMs]);

  return active && elapsed;
}
