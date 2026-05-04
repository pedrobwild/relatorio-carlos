import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type ThemeOption = 'light' | 'dark' | 'system';

/**
 * Sub-itens para inserir dentro do `UserMenu` (DropdownMenu já aberto).
 *
 * Mostra três opções (Claro / Escuro / Sistema) com radio para o estado atual.
 * Persiste via `next-themes` em `localStorage.theme`.
 */
export function ThemeToggleMenu() {
  const { theme, setTheme } = useTheme();
  // Evita flash de hidratação: só renderiza o estado real depois do mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current: ThemeOption = mounted
    ? ((theme as ThemeOption | undefined) ?? 'system')
    : 'system';

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
        Aparência
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={current}
        onValueChange={(value) => setTheme(value as ThemeOption)}
      >
        <DropdownMenuRadioItem value="light">
          <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
          Claro
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
          Escuro
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system">
          <Monitor className="mr-2 h-4 w-4" aria-hidden="true" />
          Sistema
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}

/**
 * Botão standalone (fora de menu) — alterna entre claro e escuro com clique simples.
 * Usado em telas públicas onde não há UserMenu (ex.: /auth, /minhas-obras header).
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={
        className ??
        'inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/80 hover:text-foreground hover:bg-muted transition-colors'
      }
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {/* Sempre renderiza ambos os ícones para evitar layout shift; o atual é mostrado. */}
      <Sun
        className={`h-5 w-5 transition-transform ${isDark ? 'scale-0 absolute' : 'scale-100'}`}
        aria-hidden="true"
      />
      <Moon
        className={`h-5 w-5 transition-transform ${isDark ? 'scale-100' : 'scale-0 absolute'}`}
        aria-hidden="true"
      />
    </button>
  );
}

// Re-export `useTheme` para callers que precisem do estado do tema.
export { useTheme } from 'next-themes';
