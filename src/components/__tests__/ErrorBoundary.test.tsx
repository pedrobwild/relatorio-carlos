/**
 * ErrorBoundary Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ErrorBoundary, ErrorFallback } from '../ErrorBoundary';

// Mock the error logger
vi.mock('@/lib/errorLogger', () => ({
  logError: vi.fn(),
  generateCorrelationId: vi.fn(() => 'test-correlation-id'),
}));

// Component that throws an error
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Suppress console.error for cleaner test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(getByText('Child content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(getByText('Algo deu errado')).toBeInTheDocument();
    // Generic Error 'Test error' falls into the 'unknown' bucket of mapError.
    expect(getByText(/Algo não saiu como esperado/i)).toBeInTheDocument();
  });

  it('displays correlation ID in error state', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(getByText(/ID: test-correlation-id/)).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(getByText('Custom fallback')).toBeInTheDocument();
    expect(queryByText('Algo deu errado')).not.toBeInTheDocument();
  });

  it('has retry and home buttons', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(getByText('Tentar de novo')).toBeInTheDocument();
    expect(getByText('Ir para início')).toBeInTheDocument();
    expect(getByText('Recarregar página')).toBeInTheDocument();
  });

  it('shows technical details in dev mode', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // In test mode, DEV is true by default
    const detailsElement = getByText('Detalhes técnicos (apenas dev)');
    expect(detailsElement).toBeInTheDocument();
  });
});

describe('ErrorFallback', () => {
  it('renders default message', () => {
    const { getByText } = render(<ErrorFallback />);

    expect(getByText('Erro ao carregar este conteúdo')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    const { getByText } = render(<ErrorFallback message="Custom error message" />);

    expect(getByText('Custom error message')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    const { getByText } = render(<ErrorFallback onRetry={onRetry} />);

    const retryButton = getByText('Tentar novamente');
    expect(retryButton).toBeInTheDocument();

    retryButton.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    const { queryByText } = render(<ErrorFallback />);

    expect(queryByText('Tentar novamente')).not.toBeInTheDocument();
  });
});
