import type { ComponentProps } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

/**
 * Wrapper around `next-themes` para o Portal BWild.
 *
 * - `attribute="class"` adiciona/remove `.dark` em `<html>`, ativando os tokens
 *   `.dark` definidos em `src/index.css`.
 * - `defaultTheme="system"` respeita a preferência do sistema operacional.
 * - `enableSystem` permite o terceiro estado "system" no toggle.
 * - Persiste em localStorage (`theme` por padrão do next-themes).
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
