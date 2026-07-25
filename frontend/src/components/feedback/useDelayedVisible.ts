import { useEffect, useState } from 'react';

/**
 * Segura a exibição de um indicador de carregamento por `delayMs`.
 * Esperas curtas terminam antes do prazo e não chegam a piscar na tela.
 */
export function useDelayedVisible(active: boolean, delayMs = 300): boolean {
  const [elapsed, setElapsed] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  // Ajuste de estado durante a renderização, padrão documentado pelo React para
  // reagir à mudança de uma prop. React descarta a saída e re-renderiza antes de
  // tocar no DOM, então não há commit intermediário nem pintura.
  //
  // Não mova isto para um `useEffect`: além de violar `react-hooks/set-state-in-effect`,
  // o efeito só roda depois da pintura, o que devolve justamente o piscar que este
  // hook existe para evitar. Mesmo padrão em ContractsPage e InvoiceListPage.
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
