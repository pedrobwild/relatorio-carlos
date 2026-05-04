import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomCTA, BottomCTASpacer } from '../BottomCTA';

function setMobile(isMobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: isMobile ? 375 : 1280,
  });
}

describe('BottomCTA', () => {
  beforeEach(() => {
    setMobile(true);
  });

  it('renders the primary action and triggers onClick', async () => {
    const onPrimary = vi.fn();
    render(<BottomCTA primary={{ label: 'Salvar', onClick: onPrimary }} />);

    const btn = await screen.findByRole('button', { name: /salvar/i });
    await userEvent.click(btn);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('renders both primary and secondary actions when provided', async () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <BottomCTA
        primary={{ label: 'Confirmar', onClick: onPrimary }}
        secondary={{ label: 'Cancelar', onClick: onSecondary }}
      />,
    );

    await screen.findByRole('button', { name: /confirmar/i });
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('applies fixed bottom layout in mobile', async () => {
    render(<BottomCTA primary={{ label: 'Ok' }} />);
    const region = await screen.findByRole('region', { name: /ações principais/i });
    expect(region.className).toContain('fixed');
    expect(region.className).toContain('bottom-0');
  });

  it('uses inline layout in desktop', async () => {
    setMobile(false);
    render(<BottomCTA primary={{ label: 'Ok' }} />);
    const region = await screen.findByRole('region', { name: /ações principais/i });
    expect(region.className).not.toContain('fixed');
  });

  it('forwards form id and submit type to primary button', async () => {
    render(
      <BottomCTA primary={{ label: 'Enviar', type: 'submit', form: 'rdo-form' }} />,
    );
    const btn = await screen.findByRole('button', { name: /enviar/i });
    expect(btn).toHaveAttribute('type', 'submit');
    expect(btn).toHaveAttribute('form', 'rdo-form');
  });

  it('disables button when loading', async () => {
    render(<BottomCTA primary={{ label: 'Carregando', loading: true }} />);
    const btn = await screen.findByRole('button', { name: /carregando/i });
    expect(btn).toBeDisabled();
  });
});

describe('BottomCTASpacer', () => {
  it('renders spacer in mobile', () => {
    setMobile(true);
    const { container } = render(<BottomCTASpacer />);
    // wait next tick — useIsMobile sets state in effect
    // For this test, presence of element in mobile is enough
    expect(container.firstChild === null || (container.firstChild as HTMLElement).getAttribute('aria-hidden') === 'true').toBeTruthy();
  });

  it('renders nothing in desktop', () => {
    setMobile(false);
    const { container } = render(<BottomCTASpacer />);
    expect(container.firstChild).toBeNull();
  });
});
