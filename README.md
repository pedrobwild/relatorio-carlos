# Relatório de Obra - Bwild

Portal de acompanhamento de obras com curva S e cronograma detalhado.

## Configuração do Ambiente

### 1. Criar arquivo .env

Copie o arquivo de exemplo e preencha com suas credenciais:

```sh
cp .env.example .env
```

Edite o arquivo `.env` com os valores do seu projeto Supabase:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key-aqui
VITE_SUPABASE_PROJECT_ID=seu-project-id
VITE_DEMO_MODE=false
```

**Importante:** Nunca commite o arquivo `.env` com credenciais reais.

### 2. Instalar dependências

```sh
npm install
```

### 3. Executar em desenvolvimento

```sh
npm run dev
```

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run lint` | Executa o linter |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run preview` | Preview da build de produção |

## Feature Flags

- `VITE_DEMO_MODE`: Quando `true`, habilita dados de demonstração/mock. Em produção, deve ser `false`.

## Tecnologias

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase

## Segurança

- Credenciais são gerenciadas via variáveis de ambiente
- Arquivo `.env` não é versionado
- Validação de ambiente em runtime via Zod

## Deploy

O projeto é deployado via Lovable. Para publicar:

1. Abra o projeto no Lovable
2. Clique em Share → Publish

Certifique-se de configurar as variáveis de ambiente na plataforma de deploy.
