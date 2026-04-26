# UX States — Empty, Loading, Error, Forbidden, Offline

> Padrão único para estados não-felizes do Portal BWild.
> Refs: issue #23 (Bloco 6 — Estados, Erros e Feedback).

## Princípios

1. **Estados são parte do produto, não exceções.** Vazio, lento, sem permissão, offline — desenhe, não improvise.
2. **Mensagens em pt-BR, voz BWild.** Curta, humana, sem juridiquês ou jargão técnico (RLS, JWT, Postgres, stack trace, IDs internos jamais aparecem ao usuário).
3. **Sempre ofereça um próximo passo.** "Tentar de novo", "Ir para início", "Reportar problema". Nunca um beco sem saída.
4. **Acessibilidade primeiro.** `role="alert"` para erros, `aria-live` em banners, foco gerenciado em modais.
5. **Catálogo único.** Componentes do `@/components/ui-premium`. Renderizar à mão = drift garantido.

---

## Catálogo de componentes

| Estado            | Componente                          | Quando usar                                               |
| ----------------- | ----------------------------------- | --------------------------------------------------------- |
| **Empty**         | `EmptyState` (ui-premium)           | Lista vazia, sem dados, filtros sem resultado, primeira vez |
| **Loading**       | `PageSkeleton` / `TableSkeleton` / `CardsSkeleton` / `MetricRailSkeleton` | Carregamento de página/seção (≥150ms)         |
| **Loading button**| `<Loader2 className="animate-spin" />` em `<Button>` | Apenas em ações dentro de botões                |
| **Error**         | `ErrorView` (ui-premium)            | Falha de fetch, render, render-de-seção, route fallback   |
| **Forbidden**     | `ErrorView kind="forbidden"`        | RLS, role insuficiente                                    |
| **Auth expired**  | `ErrorView kind="auth"`             | JWT expirado / sem sessão                                 |
| **Network**       | `ErrorView kind="network"` + `NetworkStatusBanner` | Offline, timeout, fetch failed                |
| **Toast**         | `notify.success/info/warning/error` (`@/lib/notify`) | Confirmação curta de ações                  |

> ❌ **Não use:** `<EmptyState>` de `@/components/EmptyState` (legacy, deprecated). Spinner solto (`<Loader2>` em página inteira). `import { toast } from 'sonner'` em `src/pages/` (ESLint bloqueia).

---

## Como usar

### EmptyState (premium)

```tsx
import { EmptyState } from '@/components/ui-premium';
import { FolderOpen, Plus } from 'lucide-react';

<EmptyState
  icon={FolderOpen}
  title="Nenhuma obra cadastrada ainda"
  description="Cadastre sua primeira obra para começar a acompanhar cronograma, documentos e formalizações."
  action={{ label: 'Criar nova obra', icon: Plus, onClick: () => navigate('/nova-obra') }}
  secondaryAction={{ label: 'Saiba mais', onClick: () => openDocs() }}
/>
```

### PageSkeleton (substitui spinners)

```tsx
import { PageSkeleton } from '@/components/ui-premium';

if (isLoading) return <PageSkeleton metrics content="table" />;
// content: 'table' | 'cards'
```

### ErrorView

```tsx
import { ErrorView } from '@/components/ui-premium';
import { mapError } from '@/lib/errorMapping';

const ue = error ? mapError(error) : null;

if (ue) {
  return (
    <ErrorView
      kind={ue.kind === 'auth' ? 'auth' : ue.kind === 'forbidden' ? 'forbidden' : ue.kind === 'network' ? 'network' : ue.kind === 'server' ? 'server' : 'unknown'}
      onRetry={() => refetch()}
      onReport={() => window.location.assign('mailto:suporte@bwild.com.br?subject=Erro%20no%20Portal')}
    />
  );
}
```

### Toast com `notify`

```tsx
import { notify } from '@/lib/notify';
import { mapError } from '@/lib/errorMapping';

try {
  await save();
  notify.success('Obra salva.');
} catch (err) {
  notify.error(mapError(err).userMessage);
}
```

> Regras:
> - `notify.success` — 3s. `notify.info` — 4s. `notify.warning` — 6s. `notify.error` — persistente, com `closeButton`.
> - Máximo 1 toast simultâneo (`visibleToasts={1}` no Toaster).
> - Posição: `top-right`. `richColors`. `expand={false}`.

### Online status & ações condicionais

```tsx
import { useCanPerform } from '@/hooks/useCanPerform';

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const { allowed, tooltip } = useCanPerform('destructive');
  return (
    <Button
      variant="destructive"
      disabled={!allowed}
      title={!allowed ? tooltip : undefined}
      onClick={onConfirm}
    >
      Excluir
    </Button>
  );
}
```

> `useCanPerform('destructive')` desabilita após **30s offline**. `useCanPerform('write')` idem. `useCanPerform('read')` é sempre permitido (cache local cobre).

### ErrorBoundary

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary name="DocumentList" feature="documents">
  <DocumentList />
</ErrorBoundary>
```

---

## Tabela de erros humanizados

`mapError(err)` (em `src/lib/errorMapping.ts`) cobre os padrões abaixo. Se identificar um padrão novo recorrente em produção, adicione aqui e no `PATTERNS`.

| `kind`       | Pattern técnico (regex case-insensitive ou status)                       | Mensagem ao usuário (pt-BR)                                                                |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `auth`       | status `401`                                                             | Sua sessão expirou. Entre novamente para continuar.                                        |
| `auth`       | `JWT`, `JWT expired`                                                     | Sua sessão expirou. Entre novamente para continuar.                                        |
| `auth`       | `invalid_token`                                                          | Sua sessão expirou. Entre novamente para continuar.                                        |
| `auth`       | `session expired`, `session_expired`                                     | Sua sessão expirou. Entre novamente para continuar.                                        |
| `auth`       | `token expired`, `token_expired`                                         | Sua sessão expirou. Entre novamente para continuar.                                        |
| `auth`       | `not authenticated`                                                      | Sua sessão expirou. Entre novamente para continuar.                                        |
| `auth`       | `auth required`, `authentication required`                               | Sua sessão expirou. Entre novamente para continuar.                                        |
| `forbidden`  | status `403`                                                             | Você não tem permissão para acessar este conteúdo. Fale com o gestor.                      |
| `forbidden`  | `row-level security`, `RLS`                                              | Você não tem permissão para acessar este conteúdo. Fale com o gestor.                      |
| `forbidden`  | `policy`, `policy violation`                                             | Você não tem permissão para acessar este conteúdo. Fale com o gestor.                      |
| `forbidden`  | `permission denied`                                                      | Você não tem permissão para acessar este conteúdo. Fale com o gestor.                      |
| `forbidden`  | `forbidden`                                                              | Você não tem permissão para acessar este conteúdo. Fale com o gestor.                      |
| `forbidden`  | `not allowed`, `insufficient privilege`                                  | Você não tem permissão para acessar este conteúdo. Fale com o gestor.                      |
| `notFound`   | status `404`                                                             | Não encontramos esse item. Pode ter sido removido ou movido.                               |
| `notFound`   | `not found`, `does not exist`, `no rows returned`                        | Não encontramos esse item. Pode ter sido removido ou movido.                               |
| `conflict`   | status `409`                                                             | Já existe um registro com esses dados.                                                     |
| `conflict`   | pg `code: 23505` (unique violation)                                      | Já existe um registro com esses dados.                                                     |
| `conflict`   | `duplicate`, `unique constraint`, `unique violation`                     | Já existe um registro com esses dados.                                                     |
| `conflict`   | `already exists`                                                         | Já existe um registro com esses dados.                                                     |
| `validation` | status `400`, `422`                                                      | Verifique os dados informados — algo não está no formato esperado.                         |
| `validation` | pg `code: 23502` (not null)                                              | Verifique os dados informados — algo não está no formato esperado.                         |
| `validation` | pg `code: 23503` (foreign key)                                           | Verifique os dados informados — algo não está no formato esperado.                         |
| `validation` | `validation`, `invalid input`, `invalid value`, `invalid format`         | Verifique os dados informados — algo não está no formato esperado.                         |
| `validation` | `missing required`, `null value`, `foreign key`                          | Verifique os dados informados — algo não está no formato esperado.                         |
| `network`    | `Failed to fetch`, `fetch failed`                                        | A conexão está lenta ou indisponível. Tente de novo em alguns segundos.                    |
| `network`    | `timeout`, `timed out`                                                   | A conexão está lenta ou indisponível. Tente de novo em alguns segundos.                    |
| `network`    | `network error`, `network request failed`                                | A conexão está lenta ou indisponível. Tente de novo em alguns segundos.                    |
| `network`    | `offline`                                                                | A conexão está lenta ou indisponível. Tente de novo em alguns segundos.                    |
| `network`    | `econnrefused`, `enotfound`, `load failed`                               | A conexão está lenta ou indisponível. Tente de novo em alguns segundos.                    |
| `server`     | status `500–599`                                                         | Tivemos um problema no servidor. Estamos trabalhando para resolver — tente de novo em instantes. |
| `server`     | `internal error`, `internal server error`                                | Tivemos um problema no servidor. Estamos trabalhando para resolver — tente de novo em instantes. |
| `server`     | `service unavailable`, `bad gateway`, `gateway timeout`                  | Tivemos um problema no servidor. Estamos trabalhando para resolver — tente de novo em instantes. |
| `server`     | `postgres`, `database error`                                             | Tivemos um problema no servidor. Estamos trabalhando para resolver — tente de novo em instantes. |
| `unknown`    | qualquer outro                                                           | Algo não saiu como esperado. Tente de novo.                                                |

---

## Critérios de aceite (issue #23)

- [x] Apenas um `EmptyState` ativo (premium); legacy marcado `@deprecated`.
- [ ] 100% das listas/dashboards usam `PageSkeleton` em vez de spinner _(migração incremental)_.
- [x] `ErrorView` premium disponível e usado pelo `ErrorBoundary` global.
- [x] Zero ocorrência de "RLS", "policy", "JWT", "Postgres" em mensagens de usuário (testado por `mapError` + regex em `errorMapping.test.ts`).
- [x] Botões destrutivos podem desabilitar em offline > 30s via `useCanPerform('destructive')`.
- [x] `notify.*` disponível; ESLint bloqueia `import { toast } from 'sonner'` em `src/pages/`.
- [x] Máximo 1 toast simultâneo (`visibleToasts={1}` no Toaster).
- [x] Mensagens de erro humanas em pt-BR sem juridiquês.

> Itens "incrementais" (migração de spinners e toasts antigos) seguem em PRs subsequentes (`Refs #23`).
