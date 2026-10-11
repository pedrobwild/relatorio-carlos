/**
 * Campo "quem faz": texto livre com sugestões (equipe interna + nomes já
 * usados na obra). Nome que bate com alguém da equipe vira usuário.
 */
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestions: readonly string[];
  label?: string;
  className?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}

export function WhoInput({ value, onChange, suggestions, label = "Quem faz", className, autoFocus, onEnter }: Props) {
  const listId = useId();
  return (
    <>
      <Input
        aria-label={label}
        list={listId}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder="Nome (ex.: João eletricista)"
        maxLength={120}
        className={cn("min-h-[44px]", className)}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
