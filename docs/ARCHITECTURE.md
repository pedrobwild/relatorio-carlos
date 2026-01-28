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
npm run test
# ou
bun run test
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

## Próximos Passos

1. Migrar hooks legados para TanStack Query pattern
2. Reorganizar pastas por feature (feature-based)
3. Adicionar mais testes de integração
4. Implementar cleanup job para arquivos deletados
