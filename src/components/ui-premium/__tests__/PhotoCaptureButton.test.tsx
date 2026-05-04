import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoCaptureButton } from '../PhotoCaptureButton';

// Mock browser-image-compression: identity (returns input).
vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  let counter = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${counter++}`);
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

function makeFile(name = 'photo.jpg', size = 100): File {
  const blob = new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
  return new File([blob], name, { type: 'image/jpeg' });
}

describe('PhotoCaptureButton', () => {
  it('renders the trigger button', () => {
    render(<PhotoCaptureButton onCapture={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tirar foto/i })).toBeInTheDocument();
  });

  it('has capture="environment" on the file input', () => {
    render(<PhotoCaptureButton onCapture={vi.fn()} />);
    const input = screen.getByTestId('photo-capture-input');
    expect(input).toHaveAttribute('capture', 'environment');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('multiple');
  });

  it('shows preview after selecting files', async () => {
    render(<PhotoCaptureButton onCapture={vi.fn()} />);
    const input = screen.getByTestId('photo-capture-input') as HTMLInputElement;

    await userEvent.upload(input, makeFile());

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /pré-visualização das fotos/i })).toBeInTheDocument();
    });
    expect(screen.getByAltText('Foto 1')).toBeInTheDocument();
  });

  it('removes a preview when X is clicked', async () => {
    render(<PhotoCaptureButton onCapture={vi.fn()} />);
    const input = screen.getByTestId('photo-capture-input') as HTMLInputElement;

    await userEvent.upload(input, makeFile());

    const remove = await screen.findByRole('button', { name: /remover foto 1/i });
    await userEvent.click(remove);

    await waitFor(() => {
      expect(screen.queryByAltText('Foto 1')).not.toBeInTheDocument();
    });
  });

  it('calls onCapture with files when confirming', async () => {
    const onCapture = vi.fn();
    render(<PhotoCaptureButton onCapture={onCapture} />);
    const input = screen.getByTestId('photo-capture-input') as HTMLInputElement;

    await userEvent.upload(input, makeFile('a.jpg'));

    const confirm = await screen.findByRole('button', { name: /confirmar 1 foto/i });
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledTimes(1);
    });
    const arg = onCapture.mock.calls[0][0] as File[];
    expect(arg).toHaveLength(1);
    expect(arg[0].name).toBe('a.jpg');
  });

  it('clears previews after successful confirm', async () => {
    const onCapture = vi.fn();
    render(<PhotoCaptureButton onCapture={onCapture} />);
    const input = screen.getByTestId('photo-capture-input') as HTMLInputElement;

    await userEvent.upload(input, makeFile());
    const confirm = await screen.findByRole('button', { name: /confirmar 1 foto/i });
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /pré-visualização/i })).not.toBeInTheDocument();
    });
  });

  it('refazer clears all previews', async () => {
    render(<PhotoCaptureButton onCapture={vi.fn()} />);
    const input = screen.getByTestId('photo-capture-input') as HTMLInputElement;

    await userEvent.upload(input, makeFile());
    const refazer = await screen.findByRole('button', { name: /refazer/i });
    await userEvent.click(refazer);

    await waitFor(() => {
      expect(screen.queryByAltText('Foto 1')).not.toBeInTheDocument();
    });
  });
});
