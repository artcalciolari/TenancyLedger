import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedVisible } from './useDelayedVisible';

function Probe({ active, delayMs }: { active: boolean; delayMs?: number }) {
  const visible = useDelayedVisible(active, delayMs);
  return <span>{visible ? 'visível' : 'oculto'}</span>;
}

describe('useDelayedVisible', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não revela antes do prazo', () => {
    render(<Probe active />);
    expect(screen.getByText('oculto')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByText('oculto')).toBeInTheDocument();
  });

  it('revela depois do prazo', () => {
    render(<Probe active />);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('visível')).toBeInTheDocument();
  });

  it('esperas curtas nunca chegam a piscar', () => {
    const { rerender } = render(<Probe active />);

    act(() => {
      vi.advanceTimersByTime(120);
    });
    rerender(<Probe active={false} />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('oculto')).toBeInTheDocument();
  });

  it('reinicia a contagem a cada nova espera', () => {
    const { rerender } = render(<Probe active />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('visível')).toBeInTheDocument();

    rerender(<Probe active={false} />);
    expect(screen.getByText('oculto')).toBeInTheDocument();

    rerender(<Probe active />);
    expect(screen.getByText('oculto')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('visível')).toBeInTheDocument();
  });
});
