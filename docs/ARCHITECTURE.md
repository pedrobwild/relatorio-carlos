# Portal BWild - Arquitetura e Padrões

## Visão Geral

Portal de gestão de obras com autenticação por roles, documentos, formalizações e relatórios semanais.

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query (React Query)
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Routing**: React Router v6

## Estrutura de Pastas

```
src/
├── assets/              # Imagens e assets estáticos
├── components/          # Componentes React
│   ├── ui/             # Componentes base (shadcn)
│   ├── admin/          # Componentes do painel admin
│   ├── formalizacao/   # Componentes de formalização
│   └── report/         # Componentes de relatórios
├── config/             # Configurações (env, flags)
├── contexts/           # React Contexts
├── data/               # Dados estáticos/seeds
├── hooks/              # Custom hooks
├── infra/              # Camada de infraestrutura
│   ├── supabase/       # Cliente Supabase
│   └── repositories/   # Data access layer
├── lib/                # Utilitários
├── pages/              # Componentes de página
├── test/               # Setup de testes
└── types/              # Tipos TypeScript
```

## Camada de Dados (Repositories)

### Princípio

**Nunca chame `supabase` diretamente nos componentes.** Use os repositórios em `src/infra/repositories/`.

### Exemplo de Uso

```typescript
// ❌ ERRADO - Supabase direto no componente
import { supabase } from '@/integrations/supabase/client';

const { data } = await supabase.from('projects').select('*');

// ✅ CORRETO - Via repositório
import { projectsRepo } from '@/infra/repositories';

const result = await projectsRepo.getStaffProjects();
if (result.error) {
  // handle error
}
const projects = result.data;
```

### Repositórios Disponíveis

| Repositório | Descrição |
|-------------|-----------|
| `documentsRepo` | Documentos de projetos |
| `projectsRepo` | Projetos e summaries |
| `filesRepo` | Sistema de arquivos escalável |

## Sistema de Arquivos (Files)

### Tabela `files`

Armazenamento de metadados escalável com:

- **Paths determinísticos**: `/{org_id}/{project_id}/{yyyy}/{mm}/{uuid}_{filename}`
- **Lifecycle**: `active` → `archived` → `deleted`
- **Deduplicação**: via checksum SHA256
- **RLS**: políticas por owner, projeto e role

### Upload de Arquivos

```typescript
import { filesRepo } from '@/infra/repositories';

const result = await filesRepo.uploadFile(file, {
  bucket: 'project-documents',
  ownerId: user.id,
  projectId: projectId,
  category: 'documento',
  entityType: 'weekly_report',
  entityId: reportId,
});

if (result.error) {
  toast.error(result.error.message);
  return;
}

const fileWithUrl = result.data;
```

### Validação

```typescript
import { filesRepo } from '@/infra/repositories';

const validation = filesRepo.validateFile(file);
if (!validation.valid) {
  toast.error(validation.error);
  return;
}
```

## Autenticação e Roles

### Roles Disponíveis

| Role | Acesso |
|------|--------|
| `customer` | Visualização de projetos atribuídos |
| `engineer` | Gestão de projetos atribuídos |
| `manager` | Supervisão de engenheiros |
| `admin` | Acesso total ao sistema |

### Route Guards

```tsx
// Qualquer usuário autenticado
<ProtectedRoute>
  <Page />
</ProtectedRoute>

// Apenas staff (engineer, manager, admin)
<StaffRoute>
  <Page />
</StaffRoute>

// Apenas customers
<CustomerRoute>
  <Page />
</CustomerRoute>

// Apenas admin
<AdminRoute>
  <Page />
</AdminRoute>
```

## Hooks de Dados

### Com TanStack Query (Recomendado)

```typescript
// useOptimizedQueries.ts - já usa TanStack Query
import { usePendingItemsWithContext } from '@/hooks/useOptimizedQueries';

const { data, isLoading, error } = usePendingItemsWithContext(projectId);
```

### Legados (Migrar gradualmente)

Hooks como `useDocuments`, `useProjects` usam `useState/useEffect` direto. Migrar para TanStack Query quando possível.

## Padrões de Código

### Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Hook | `useX` | `useDocuments` |
| Repository | `xRepo` | `documentsRepo` |
| Component | PascalCase | `DocumentCard` |
| Types | PascalCase | `ProjectDocument` |

### Tratamento de Erros

```typescript
// Nos repositórios
const result = await documentsRepo.getProjectDocuments(projectId);
if (result.error) {
  console.error('Error:', result.error);
  // Handle error
  return;
}

// Nos hooks com TanStack Query
const { data, error, isError } = useQuery({...});
if (isError) {
  toast.error(getUserFriendlyMessage(error));
}
```

### Componentes

1. **Presentational**: Apenas UI, recebe props
2. **Container**: Conecta dados, lógica de negócio

```tsx
// Presentational
const DocumentCard = ({ doc, onApprove }: Props) => (
  <Card>...</Card>
);

// Container (ou hook)
const DocumentsContainer = () => {
  const { documents } = useDocuments(projectId);
  return <DocumentCard doc={documents[0]} onApprove={handleApprove} />;
};
```

## Testes

### Estrutura

```
src/
├── components/__tests__/    # Testes de componentes
├── hooks/__tests__/         # Testes de hooks
├── lib/__tests__/           # Testes de utilitários
└── test/
    ├── setup.ts             # Setup do Vitest
    └── mocks/               # Mocks globais
```

### Executar Testes

```bash
# Unit tests (Vitest)
npx vitest run

# Type check
npx tsc -b

# E2E (Playwright)
npx playwright test

# E2E smoke only
npx playwright test smoke.spec.ts
```

## Debug

### Auth Debug

```javascript
// No console do browser
localStorage.setItem('debug_auth', '1');
// Depois recarregue a página
// Logs: [DBG-AUTH], [DBG-NAV], [DBG-VIS]
```

## Segurança

### RLS (Row Level Security)

Todas as tabelas têm RLS habilitado. As políticas garantem:

- Usuários só veem dados que têm permissão
- Staff pode gerenciar projetos atribuídos
- Admin tem acesso total

### Storage

- Buckets não-públicos por padrão
- URLs assinadas para download (1h de validade)
- Validação de MIME type e tamanho no cliente e servidor

## Configuração de Ambiente

Variáveis automáticas (não editar manualmente):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Variáveis opcionais (injetar no CI/build):

```bash
# Build info (para página de diagnóstico)
VITE_GIT_COMMIT=$(git rev-parse HEAD)
VITE_GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
VITE_BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VITE_APP_VERSION=1.0.0-beta

# Error monitoring
VITE_SENTRY_PROJECT_URL=https://sentry.io/organizations/bwild/projects/portal/
```

## Monitoramento e Diagnóstico

### Página de Health Check

Acessível em `/admin/health` (apenas admins):

- **Build Info**: commit, branch, versão, ambiente
- **Service Status**: Auth, DB, Storage, RLS
- **Performance**: latência, histórico
- **Tools**: limpar cache, copiar relatório, emitir erro de teste

### Error Monitoring

```typescript
import { captureError, captureException, createFeatureErrorCapture } from '@/lib/errorMonitoring';

// Captura simples
captureError(error, { feature: 'documents', action: 'upload' });

// Com extras
captureException(error, {
  feature: 'formalizacoes',
  action: 'sign',
  extra: { formalizationId: '...' },
});

// Scoped por feature
const docErrors = createFeatureErrorCapture('documents');
docErrors.capture(error, { action: 'delete' });
```

## Padrões de Segurança

Para padrões detalhados de segurança, checklists obrigatórios antes de iniciar novos módulos e templates de RPCs de transição de estado, consulte **[docs/SECURITY_PATTERNS.md](./SECURITY_PATTERNS.md)**.

## Cockpit de Decisão (JTBD)

O *Cockpit de Decisão* responde, no topo de cada superfície, a única pergunta que importa: **"o que eu preciso fazer agora?"**. O padrão evita que o usuário tenha que navegar 3 níveis para descobrir o que está bloqueado.

### Camadas

| Camada | Onde mora | Função |
| --- | --- | --- |
| **Hook agregador** | `src/hooks/useNextActions.ts` | Combina `usePendencias`, `useClientDashboard` e `useFormalizacoes` em uma lista ranqueada (atraso > tácita > pagamento > aprovação), corta em 3 itens. Função pura `rankNextActions()` é testável isoladamente. |
| **Bloco de UI** | `src/components/cockpit/NextActionsBlock.tsx` | Renderiza ≤3 cards com `StatusBadge` + CTA primário. Estado vazio é "Tudo em dia" (não some — preserva canal de confiança). Mobile-first: CTAs com `min-height: 44px`. |
| **Tracking** | `src/lib/amplitude.ts` | Eventos `next_action_displayed` e `next_action_clicked` com payload `{ type, urgency, owner }`. Disparados pelo `NextActionsBlock` no mount e nos cliques. |
| **Painel staff** | `src/pages/PainelObras.tsx` | `MetricRail` no topo + dot semântico na primeira coluna ("Sinal"). KPIs filtram a tabela via `useSearchParams`. Cor vermelha apenas no dot — nunca na linha inteira. |

### Aprovação tácita rastreável

A aprovação tácita do projeto executivo (cliente silente além do prazo contratual) é tratada como evento jurídico — não pode depender do front-end:

1. **Trigger DB** `log_executive_tacit_approval` (`supabase/migrations/20260504061500_executive_tacit_approval_event.sql`) detecta `project_documents.status='approved' AND approved_by IS NULL` para `document_type='executive_project'` e insere `domain_events` row com `event_type='executive.tacit_approval'` carregando `{ document_id, document_hash, deadline_iso, days_silent, document_version, document_name }`.
2. **Banner UI** `TacitApprovalNotice` em `src/pages/Executivo.tsx` consome `approved_at`/`checksum`/`created_at` do documento e exibe o texto humano: *"Aprovação automática registrada em DD/MM às HH:MM porque o prazo contratual de X dias venceu sem manifestação."* Mobile e desktop recebem o mesmo payload (paridade obrigatória).
3. **`EVENT_TYPES.EXECUTIVE_TACIT_APPROVAL`** (`src/hooks/useDomainEvents.ts`) padroniza o tipo do evento para a `ActivityTimeline` e auditorias futuras.

> **Regra de ouro:** quando a operação tem implicação jurídica (tácita, formalização, NC), a fonte da verdade é o trigger DB, não o front. Componentes apenas refletem o que o banco já registrou.

## Próximos Passos

1. Migrar hooks legados para TanStack Query pattern
2. Reorganizar pastas por feature (feature-based)
3. Adicionar mais testes de integração
4. Implementar cleanup job para arquivos deletados
