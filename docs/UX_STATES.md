# UX States — Padrão de estados, erros e feedback (Bloco 6)

Este documento padroniza como o Portal BWild apresenta estados não-felizes
(empty / loading / error / forbidden / offline) e como os erros técnicos são
traduzidos em mensagens humanas.

> **Princípio**: o usuário nunca deve ver "Row Level Security policy violated",
> "JWT expired" ou "Postgres". Toda saída técnica passa por uma camada de
> humanização — `mapError` em `src/lib/errorMapping.ts`.

---

## 1. Catálogo de componentes

| Estado     | Componente                                       | Usar para                                                                |
|------------|--------------------------------------------------|--------------------------------------------------------------------------|
| Empty      | `EmptyState` em `@/components/ui-premium`        | Lista sem dados, primeira vez, filtros sem resultado, sem permissão suave |
| Loading    | `PageSkeleton`, `TableSkeleton`, `CardsSkeleton` | Carregamento inicial / refetch                                            |
| Error      | `ErrorView` em `@/components/ui-premium`         | Query/mutation com erro, error boundary, falhas de rede                   |
| Forbidden  | `ErrorView kind="forbidden"`                     | RLS / 403                                                                 |
| Offline    | `NetworkStatusBanner` (global)                   | Banner top-of-page; ações destrutivas usam `useCanPerform`                |

> ⚠️ **Deprecado**: `src/components/EmptyState.tsx` (legacy). Use
> `@/components/ui-premium`. O legacy está marcado com `@deprecated` JSDoc e
> será removido em uma futura limpeza.

### EmptyState (premium)
```tsx
import { EmptyState } from '@/components/ui-premium';
import { FileX } from 'lucide-react';

<EmptyState
  icon={FileX}
  title="Nenhum documento ainda"
  description="Os documentos da obra aparecerão aqui assim que forem enviados."
  action={{ label: 'Enviar documento', onClick: handleUpload }}
  secondaryAction={{ label: 'Saiba mais', onClick: openHelp }}
/>
```

### PageSkeleton (loading)
```tsx
import { PageSkeleton } from '@/components/ui-premium';

if (isLoading) return <PageSkeleton metrics content="table" />;
```

> Substitua todos os spinners genéricos (`<div className="animate-spin..."/>`)
> em listas/dashboards por `PageSkeleton` apropriado. Spinner em botão
> (`<Button isLoading />`) continua válido.

### ErrorView
```tsx
import { ErrorView } from '@/components/ui-premium';
import { mapError } from '@/lib/errorMapping';

if (error) {
  const ue = mapError(error);
  return (
    <ErrorView
      kind={ue.kind}
      description={ue.userMessage}
      onRetry={() => refetch()}
      onReport={() => openSupport()}
      technicalDetails={ue.technicalDetails}
    />
  );
}
```

---

## 2. Mapeamento de erros (`mapError`)

Source: `src/lib/errorMapping.ts`. Todos os erros saídos de Supabase, Edge
Functions, fetch ou throws atravessam essa função antes de virar UI.

Resultado:
```ts
interface UserError {
  kind: 'forbidden' | 'auth' | 'server' | 'network' | 'conflict'
       | 'not_found' | 'validation' | 'rate_limit' | 'storage' | 'unknown';
  userMessage: string;       // pt-BR, voz BWild, sem jargão
  technicalDetails?: string; // preservado para logs/DEV
  suggestedAction?: 'retry' | 'redirect_auth' | 'contact_support' | 'check_data' | 'wait';
  code?: string;             // código original do banco/HTTP
}
```

### 2.1 Tabela de tradução (técnico → usuário)

| # | Padrão técnico                                            | Kind        | Mensagem ao usuário (pt-BR)                                                         |
|---|-----------------------------------------------------------|-------------|--------------------------------------------------------------------------------------|
| 1 | `new row violates row-level security policy`              | forbidden   | Você não tem permissão para acessar este conteúdo. Fale com o gestor da obra.        |
| 2 | `RLS denied` / `policy violation`                         | forbidden   | Você não tem permissão para acessar este conteúdo. Fale com o gestor da obra.        |
| 3 | `permission denied for table X`                           | forbidden   | Você não tem permissão para esta ação.                                               |
| 4 | HTTP 403                                                  | forbidden   | Você não tem permissão para esta ação.                                               |
| 5 | `unauthorized`                                            | forbidden   | Você não tem permissão para esta ação.                                               |
| 6 | `JWT expired`                                             | auth        | Sua sessão expirou. Entre novamente para continuar.                                  |
| 7 | `JWT malformed` / `invalid_token` / `invalid jwt`         | auth        | Sua sessão expirou. Entre novamente para continuar.                                  |
| 8 | `session expired`                                         | auth        | Sua sessão expirou. Entre novamente para continuar.                                  |
| 9 | HTTP 401                                                  | auth        | Sua sessão expirou. Entre novamente para continuar.                                  |
| 10 | `not authenticated` / `no api key`                        | auth        | Você precisa entrar na sua conta para fazer isso.                                    |
| 11 | `Failed to fetch`                                         | network     | Não foi possível conectar ao servidor. Verifique sua internet.                       |
| 12 | `NetworkError` / `net::ERR_*`                             | network     | Não foi possível conectar ao servidor. Verifique sua internet.                       |
| 13 | `timeout` / `ETIMEDOUT`                                   | network     | A conexão está lenta. Tente de novo em alguns segundos.                              |
| 14 | `offline` / `ECONNREFUSED` / `aborted`                    | network     | Sem conexão. Quando voltar a internet, tente novamente.                              |
| 15 | HTTP 5xx genérico                                         | server      | Tivemos um problema no servidor. Estamos trabalhando para resolver.                  |
| 16 | `internal server error`                                   | server      | Tivemos um problema no servidor. Estamos trabalhando para resolver.                  |
| 17 | `service unavailable` / `bad gateway`                     | server      | Tivemos um problema no servidor. Estamos trabalhando para resolver.                  |
| 18 | `PGRST*` / `Postgres ...`                                 | server      | Algo não funcionou como esperado. Tente novamente em instantes.                      |
| 19 | `duplicate key` / `unique constraint` / `23505`           | conflict    | Já existe um registro com esses dados.                                               |
| 20 | `foreign_key_violation` / `23503`                         | conflict    | Esta operação não é permitida porque há dados relacionados em uso.                   |
| 21 | `check_violation` / `23514`                               | validation  | Os dados informados não estão no formato esperado.                                   |
| 22 | `not_null_violation` / `23502` / `null value`             | validation  | Preencha todos os campos obrigatórios.                                               |
| 23 | HTTP 404 / `not found` / `object not found`               | not_found   | Não encontramos esse item. Talvez tenha sido movido ou removido.                     |
| 24 | HTTP 413 / `payload too large`                            | storage     | Arquivo muito grande. Reduza o tamanho e tente de novo.                              |
| 25 | `bucket not found` / `storage error`                      | storage     | Não conseguimos acessar o armazenamento. Tente novamente em instantes.               |
| 26 | HTTP 429 / `Too Many Requests` / `rate limit`             | rate_limit  | Muitas tentativas em pouco tempo. Aguarde alguns segundos.                           |
| 27 | (sem padrão) — `something unexpected`                     | unknown     | Algo não saiu como esperado. Tente de novo em instantes.                             |
| 28 | `null` / `undefined`                                      | unknown     | Algo não saiu como esperado. Tente de novo em instantes.                             |
| 29 | Sessão expirada por refresh token revogado                | auth        | Sua sessão expirou. Entre novamente para continuar.                                  |
| 30 | Falha em upload (timeout no signed URL)                   | network     | A conexão está lenta. Tente de novo em alguns segundos.                              |

> A tabela acima é **garantia mínima** — `errorMapping.test.ts` verifica que
> nenhum padrão acima vaza termos como `RLS`, `JWT`, `Postgres`, `PGRST`,
> `policy` ou `row-level` na mensagem ao usuário.

---

## 3. Padrão de toasts (`notify`)

Source: `src/lib/notify.ts`.

```ts
import { notify } from '@/lib/notify';

notify.success('Documento enviado com sucesso.');
notify.info('Sincronizando dados…');
notify.warning('Você está editando um relatório enviado.');
notify.error(error); // aceita Error/objeto — humanizado automaticamente
```

| Tipo    | Duração     | Visual         | Quando usar                                          |
|---------|-------------|----------------|------------------------------------------------------|
| success | 3s          | check verde    | Operação concluída                                   |
| info    | 4s          | i azul         | Confirmação não-crítica (ex: cópia, prefetch)        |
| warning | 6s          | ! amarelo      | Aviso reversível (ex: dado parcial)                  |
| error   | até fechar  | x vermelho     | Falha — usuário precisa ler e decidir                |

Configuração (`src/components/ui/sonner.tsx`):
- `visibleToasts={1}` — no máximo 1 toast simultâneo
- `position` — `top-right` desktop / `top-center` mobile
- `expand={false}` `richColors` `closeButton` — visual consistente

> ❌ Não importe `toast` de `sonner` direto em pages. Use `notify`.

---

## 4. Network status & ações condicionais

Source: `src/hooks/useOnlineStatus.ts`, `src/hooks/useCanPerform.ts`,
`src/components/NetworkStatusBanner.tsx`.

```tsx
const { allowed, message } = useCanPerform('destructive');

<Tooltip content={!allowed ? message : undefined}>
  <Button disabled={!allowed} onClick={handleDelete}>
    Excluir
  </Button>
</Tooltip>
```

Regras:
- `read` — sempre permitido (cache resolve).
- `write` — permitido somente online; bloqueado offline.
- `destructive` — permitido somente após >30s de conexão estável (evita
  perder trabalho em offline persistente). Tooltip explica o motivo.

---

## 5. Repository wrapper

Source: `src/infra/repositories/base.repository.ts`.

`executeQuery` / `executeListQuery` agora retornam um erro **augmentado**:

```ts
const result = await projectsRepo.getStaffProjects();
if (result.error) {
  notify.error(result.error.userError); // já humanizado
  return;
}
```

`result.error.userError` é o `UserError` mapeado. Código legado que lê
`result.error.message` continua funcionando — a propriedade técnica original
está preservada.

---

## 6. Critérios de aceite (Bloco 6)

- [x] Catálogo único — `EmptyState` premium é a única fonte; legacy marcado `@deprecated`.
- [x] `ErrorView` padrão criado e reexportado em `ui-premium`.
- [x] `mapError` cobre 30+ padrões — 0 vazamentos de termos técnicos.
- [x] `ErrorBoundary` global usa `ErrorView` no fallback.
- [x] `notify.*` configurado com durações e teto de 1 toast simultâneo.
- [x] `useOnlineStatus` + `useCanPerform` para travar destrutivos em offline > 30s.
- [x] Wrapper `executeQuery` aplica `mapError` automaticamente.
- [ ] Pages legadas migradas para `notify.*` e `PageSkeleton` (rolling — abrir PRs por área).
- [ ] Lint custom para proibir `import { toast } from 'sonner'` em pages (futuro).
