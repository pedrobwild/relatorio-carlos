# Guia de Contribuição

## Criando uma Nova Feature

### 1. Estrutura Recomendada

Para features grandes, crie uma pasta dedicada:

```
src/features/nova-feature/
├── components/
│   ├── NovaFeatureCard.tsx
│   └── NovaFeatureList.tsx
├── hooks/
│   └── useNovaFeature.ts
├── types.ts
└── index.ts  # barrel export
```

### 2. Criando um Repository

```typescript
// src/infra/repositories/nova-feature.repository.ts

import { 
  supabase, 
  executeQuery, 
  executeListQuery,
  type RepositoryResult,
} from './base.repository';

export interface NovaFeature {
  id: string;
  name: string;
  // ...
}

export async function getNovaFeatures(
  projectId: string
): Promise<RepositoryListResult<NovaFeature>> {
  return executeListQuery(async () => {
    const { data, error } = await supabase
      .from('nova_features')
      .select('*')
      .eq('project_id', projectId);
    return { data, error };
  });
}
```

### 3. Criando um Hook com TanStack Query

```typescript
// src/features/nova-feature/hooks/useNovaFeature.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { novaFeatureRepo } from '@/infra/repositories';
import { toast } from 'sonner';

export function useNovaFeatures(projectId: string) {
  return useQuery({
    queryKey: ['nova-features', projectId],
    queryFn: async () => {
      const result = await novaFeatureRepo.getNovaFeatures(projectId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!projectId,
  });
}

export function useCreateNovaFeature() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: novaFeatureRepo.createNovaFeature,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nova-features'] });
      toast.success('Criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar: ' + error.message);
    },
  });
}
```

### 4. Componente Container

```tsx
// src/features/nova-feature/components/NovaFeatureContainer.tsx

import { useNovaFeatures, useCreateNovaFeature } from '../hooks/useNovaFeature';
import { NovaFeatureList } from './NovaFeatureList';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function NovaFeatureContainer({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useNovaFeatures(projectId);
  const createMutation = useCreateNovaFeature();

  if (isLoading) {
    return <Loader2 className="animate-spin" />;
  }

  if (error) {
    return <p className="text-destructive">Erro: {error.message}</p>;
  }

  return (
    <div>
      <Button 
        onClick={() => createMutation.mutate({ projectId, name: 'Nova' })}
        disabled={createMutation.isPending}
      >
        Adicionar
      </Button>
      <NovaFeatureList items={data ?? []} />
    </div>
  );
}
```

## Boas Práticas

### TypeScript

```typescript
// ✅ Use tipos explícitos para props
interface Props {
  projectId: string;
  onSuccess?: () => void;
}

// ✅ Evite `any`
const data: ProjectDocument[] = result.data;

// ✅ Use type guards
function isDocument(item: unknown): item is ProjectDocument {
  return typeof item === 'object' && item !== null && 'id' in item;
}
```

### Componentes

```tsx
// ✅ Extraia lógica para hooks
const { data, actions } = useNovaFeature();

// ✅ Componentes pequenos e focados
const Card = ({ title }: { title: string }) => <div>{title}</div>;

// ✅ Use memo para listas grandes
const MemoizedCard = React.memo(Card);
```

### Estilização

```tsx
// ✅ Use tokens semânticos
<div className="bg-background text-foreground" />

// ❌ Evite cores diretas
<div className="bg-white text-black" />

// ✅ Use variantes de componentes
<Button variant="destructive">Deletar</Button>
```

## Checklist de PR

- [ ] Código segue os padrões do projeto
- [ ] Testes passando
- [ ] Sem `console.log` (exceto `console.error`)
- [ ] Sem `any` desnecessário
- [ ] Componentes documentados se complexos
- [ ] RLS policies revisadas se tocou em banco
