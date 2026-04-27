import { useEffect, useId, useRef, useState, type ClipboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatBR, maskBRDate, parseFlexibleBRDate } from '@/lib/dates';
import { AutosaveStatusIcon, useFieldAutosave } from './InlineAutosave';

interface MaskedDateFieldProps {
  /** Valor canônico em ISO `yyyy-MM-dd` ou null. */
  value: string | null | undefined;
  /** Recebe ISO `yyyy-MM-dd` ou null (quando o usuário limpa). */
  onSave: (val: string | null) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Campo de data com máscara dd/MM/yyyy + parsing flexível.
 *
 * - Aceita digitação manual (aplica máscara progressiva).
 * - Ao colar, remascara imediatamente. Se o conteúdo colado for um ISO
 *   válido (`yyyy-MM-dd`) ou outra forma reconhecida pelo
 *   `parseFlexibleBRDate`, comita o valor canônico no mesmo gesto, sem
 *   exigir blur.
 * - Em blur, valida e persiste; entradas inválidas mostram erro inline.
 */
const INVALID_DATE_MESSAGE = 'Data inválida. Use o formato dd/mm/aaaa.';

export function MaskedDateField({
  value,
  onSave,
  placeholder = 'dd/mm/aaaa',
  className,
  ariaLabel,
}: MaskedDateFieldProps) {
  const [text, setText] = useState(() => formatBR(value ?? null));
  const [error, setError] = useState<string | null>(null);
  const lastCommittedRef = useRef<string | null>(value ?? null);
  const { saveState, runSave } = useFieldAutosave(value ?? '');
  const errorId = useId();

  // Mantém o input em sincronia quando o valor canônico muda externamente.
  useEffect(() => {
    if (value !== lastCommittedRef.current) {
      setText(formatBR(value ?? null));
      lastCommittedRef.current = value ?? null;
      setError(null);
    }
  }, [value]);

  const commit = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError(null);
      if (lastCommittedRef.current !== null) {
        lastCommittedRef.current = null;
        await runSave('', async () => {
          await onSave(null);
        });
      }
      return;
    }
    const iso = parseFlexibleBRDate(trimmed);
    if (!iso) {
      setError(INVALID_DATE_MESSAGE);
      return;
    }
    setError(null);
    setText(formatBR(iso));
    if (iso !== lastCommittedRef.current) {
      lastCommittedRef.current = iso;
      await runSave(iso, async () => {
        await onSave(iso);
      });
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    e.preventDefault();

    // Tenta parse direto (ISO ou formato BR completo) — comita sem blur.
    const iso = parseFlexibleBRDate(pasted.trim());
    if (iso) {
      setText(formatBR(iso));
      setError(null);
      if (iso !== lastCommittedRef.current) {
        lastCommittedRef.current = iso;
        void runSave(iso, async () => {
          await onSave(iso);
        });
      }
      return;
    }

    // Fallback: aplica a máscara progressiva e aguarda mais digitação/blur.
    const masked = maskBRDate(pasted);
    setText(masked);
    setError(masked.length === 10 ? INVALID_DATE_MESSAGE : null);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setText(maskBRDate(e.target.value));
          if (error) setError(null);
        }}
        onPaste={handlePaste}
        onBlur={(e) => void commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn('pr-7', error && 'border-destructive focus-visible:ring-destructive')}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        <AutosaveStatusIcon state={saveState} />
      </span>
      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-1 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
