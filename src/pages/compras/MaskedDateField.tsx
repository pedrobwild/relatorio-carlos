/**
 * MaskedDateField — input de data com máscara `dd/MM/yyyy` e autosave.
 *
 * Por que existe: `<input type="date">` exige formato canônico ISO e oferece
 * UX inconsistente entre navegadores. No Brasil, usuários esperam digitar
 * `23/04/2025` direto, ou colar valores de planilhas. Este componente:
 *
 *  - Aplica máscara `dd/MM/yyyy` em tempo real (via `maskBRDate`).
 *  - Aceita também colagens em ISO (`yyyy-MM-dd`) ou com `-` no lugar de `/`.
 *  - Valida calendário real (descarta `31/02`) via `parseFlexibleBRDate`.
 *  - Persiste sempre em `yyyy-MM-dd` para colunas `date` do Postgres.
 *  - Mostra ícone de status (saving/saved/error) ao lado, padronizado
 *    com `useFieldAutosave`.
 *
 * Uso típico — campo de vencimento no detalhe expansível de uma compra:
 *
 *   <MaskedDateField
 *     value={purchase.payment_due_date}
 *     onSave={(v) => onUpdateField(purchase.id, 'payment_due_date', v)}
 *   />
 */
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatBR, maskBRDate, parseFlexibleBRDate } from '@/lib/dates';
import { useFieldAutosave, AutosaveStatusIcon } from './InlineAutosave';

interface MaskedDateFieldProps {
  /** ISO `yyyy-MM-dd` ou null. */
  value: string | null;
  /** Recebe ISO `yyyy-MM-dd` válido, ou `null` quando o campo é apagado. */
  onSave: (value: string | null) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}

export function MaskedDateField({
  value,
  onSave,
  placeholder = 'dd/mm/aaaa',
  className,
  inputClassName,
  ariaLabel,
}: MaskedDateFieldProps) {
  // Mostra `dd/MM/yyyy` para o usuário; mantém estado local controlado para
  // refletir a máscara enquanto digita.
  const [draft, setDraft] = useState<string>(() => formatBR(value));
  const [invalid, setInvalid] = useState(false);
  const { saveState, runSave } = useFieldAutosave(value);

  // Sincroniza quando o valor externo muda (ex.: edição em outra UI).
  useEffect(() => {
    setDraft(formatBR(value));
    setInvalid(false);
  }, [value]);

  const handleChange = (raw: string) => {
    setDraft(maskBRDate(raw));
    if (invalid) setInvalid(false);
  };

  const commit = () => {
    const trimmed = draft.trim();
    // Apagar = limpar o campo no banco
    if (!trimmed) {
      setInvalid(false);
      runSave(null, async (v) => onSave(v));
      return;
    }
    const iso = parseFlexibleBRDate(trimmed);
    if (!iso) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    // Reformatar para garantir consistência visual após commit
    setDraft(formatBR(iso));
    // Só dispara save quando o valor realmente mudou
    if (iso !== value) {
      runSave(iso, async (v) => onSave(v));
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'h-8 text-sm tabular-nums bg-transparent border-transparent',
          'hover:border-input focus:border-input transition-colors',
          invalid && 'border-destructive/60 focus-visible:ring-destructive/40',
          saveState !== 'idle' && 'pr-7',
          inputClassName,
        )}
      />
      <AutosaveStatusIcon
        state={saveState}
        className="absolute right-2 top-1/2 -translate-y-1/2"
      />
      {invalid && (
        <p className="text-[10px] text-destructive mt-0.5" role="alert">
          Data inválida — use dd/mm/aaaa
        </p>
      )}
    </div>
  );
}
