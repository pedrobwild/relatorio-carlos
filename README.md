# Portal BWild

Portal de gestão de obras com autenticação por roles, documentos, formalizações e relatórios semanais.

## Documentação

- [Arquitetura e Padrões](docs/ARCHITECTURE.md)
- [Guia de Contribuição](docs/CONTRIBUTING.md)

## Quick Start

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Executar testes
npm run test
```

## Stack

| Categoria | Tecnologia |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State | TanStack Query |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Routing | React Router v6 |

## Configuração do Ambiente

As variáveis de ambiente são configuradas automaticamente pelo Lovable Cloud:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run test` | Executa testes |
| `npm run lint` | Executa o linter |
| `npm run preview` | Preview da build |

## Estrutura Principal

```
src/
├── components/     # Componentes React
├── hooks/          # Custom hooks
├── infra/          # Infraestrutura (repositories, supabase)
├── pages/          # Páginas/rotas
└── lib/            # Utilitários
```

## Segurança

- RLS (Row Level Security) em todas as tabelas
- Autenticação via Supabase Auth
- Storage com URLs assinadas
- Validação de MIME type e tamanho de arquivos

## Deploy

O projeto é deployado via Lovable. Para publicar:

1. Abra o projeto no Lovable
2. Clique em Share → Publish
