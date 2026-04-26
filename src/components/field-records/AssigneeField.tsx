/**
 * Select de responsável (assignee) para um Field Record.
 *
 * Lista a equipe interna via `useStaffUsers` por padrão; aceita override via
 * `users` quando o consumidor já tem a lista filtrada (ex.: membros do
 * projeto, em vez de todo o staff).
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useStaffUsers, type StaffUser } from '@/hooks/useStaffUsers';

interface AssigneeOption {
  id: string;
  name: string;
  /** Texto secundário (ex.: cargo, email). Opcional. */
  hint?: string;
}

interface AssigneeFieldProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
  label?: string;
  required?: boolean;
  className?: string;
  /** Lista custom de usuários. Se omitida, usa `useStaffUsers`. */
  users?: AssigneeOption[];
  /** Texto exibido quando nenhum responsável está selecionado. */
  placeholder?: string;
  /** Permite limpar a seleção (mostra item "(nenhum)"). */
  allowEmpty?: boolean;
}

const NONE = '__none__';

export function AssigneeField({
  value,
  onChange,
  label = 'Responsável',
  required,
  className,
  users,
  placeholder = 'Selecionar responsável…',
  allowEmpty = true,
}: AssigneeFieldProps) {
  const staffQuery = useStaffUsers();
  const list: AssigneeOption[] =
    users ??
    (staffQuery.data ?? []).map((u: StaffUser) => ({
      id: u.id,
      name: u.nome || u.email,
      hint: u.perfil,
    }));

  const handleChange = (next: string) => {
    if (next === NONE) onChange(null);
    else onChange(next);
  };

  return (
    <div className={className}>
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value ?? NONE} onValueChange={handleChange}>
        <SelectTrigger className="h-9 mt-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && (
            <SelectItem value={NONE}>
              <span className="text-muted-foreground italic">(nenhum)</span>
            </SelectItem>
          )}
          {list.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <span className="flex flex-col">
                <span>{u.name}</span>
                {u.hint && (
                  <span className="text-[10px] text-muted-foreground">{u.hint}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
