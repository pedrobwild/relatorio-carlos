# Tom de voz BWild

Guia oficial de microcopy do Portal BWild. Toda copy nova — botões, toasts, mensagens de erro, estados vazios, confirmações destrutivas — segue este documento. Quando houver dúvida, prefira o exemplo "depois".

## Princípios

1. **Curto.** Frases de uma linha. Se precisa de duas, encurte. Cliente leigo lê no celular, no canteiro, com tempo curto.
2. **Humano, sem juridiquês.** Fale como uma engenheira explica para o cliente: técnica, mas direta. Nada de "Operação inválida" ou "violates foreign key constraint".
3. **Ação clara.** CTA usa verbo no imperativo: "Registrar medição", "Aprovar agora", "Ver pendências". Nunca "Clique aqui" ou "Saiba mais".
4. **Sem decoração.** Zero emoji. Zero ponto de exclamação gratuito. Zero "Ops!", "Eita!", "Atenção!".
5. **Erro técnico fica oculto.** Mensagem para o usuário é humana. Detalhe técnico vai pro log (`captureError`, `errorLogger`) ou pra um bloco `<details>` colapsado.
6. **Confirmação destrutiva descreve consequência concreta.** Quantidade afetada, irreversibilidade, prazo. Nunca apenas "Tem certeza?".
7. **Termo técnico de obra é explicado, não substituído.** RDO, ART, BDI, retenção, medição continuam sendo RDO, ART, BDI — mas com `<Glossary>` explicando em linguagem leiga na primeira ocorrência da tela.
8. **PT-BR sempre.** O usuário é brasileiro. Sem anglicismos quando há termo brasileiro consolidado.

## Exemplos pareados (ruim → bom)

### Sucesso

| ❌ Antes | ✅ Depois |
|---------|----------|
| "Operação realizada com sucesso!" | "Medição registrada" |
| "Salvo com sucesso!!" | "Alterações salvas" |
| "Cadastro efetuado com sucesso." | "Obra cadastrada" |
| "Formalização aprovada com êxito!" | "Aprovação registrada" |
| "Upload realizado com sucesso!" | "Arquivo enviado" |

### Erro

| ❌ Antes | ✅ Depois |
|---------|----------|
| "Ops! Algo deu errado." | "Não consegui salvar agora. Tenta de novo em alguns segundos." |
| "Eita, ocorreu um erro." | "Falha de conexão. Verifica sua internet." |
| "Operação inválida." | "Esta obra já tem uma medição neste mês. Edite a existente em vez de criar nova." |
| "violates foreign key constraint" | "Não dá pra excluir: existem compras vinculadas a esta obra." |
| "JWT expired" | "Sua sessão expirou. Entre de novo." |

### Estado vazio

| ❌ Antes | ✅ Depois |
|---------|----------|
| "Nenhum registro encontrado." | "Nenhuma compra pendente — tudo em dia" |
| "Lista vazia." | "Você ainda não cadastrou obras. Comece pela primeira." |
| "Sem dados." | "Nenhum RDO esta semana. Lance o de hoje pra começar." |

### Confirmação destrutiva

| ❌ Antes | ✅ Depois |
|---------|----------|
| "Tem certeza que deseja excluir?" | "Excluir esta obra remove 47 medições e 12 compras vinculadas. Não dá pra desfazer." |
| "Confirma a exclusão?" | "Apagar este RDO apaga as 8 fotos do dia. Sem volta." |
| "Deseja prosseguir?" | "Cancelar esta formalização notifica o cliente por e-mail." |

### CTAs

| ❌ Antes | ✅ Depois |
|---------|----------|
| "Clique aqui para enviar" | "Enviar para aprovação" |
| "Salvar dados" | "Salvar medição" |
| "Saiba mais" | "Ver detalhes da compra" |

## Regras práticas

- **Verbo no imperativo nos CTAs**: "Registrar", "Aprovar", "Excluir", "Convidar". Nunca "Clique", "Aperte", "Selecione aqui".
- **Não comece toast com saudação.** Direto na ação: "Medição registrada", não "Pronto! Medição registrada".
- **Erro de rede usa fallback humano.** Mensagens cruas do Postgres/Supabase passam por `getUserFriendlyMessage` (`src/lib/queryClient.ts`).
- **Confirmação destrutiva sempre informa quantidade afetada.** Antes de mostrar o `<AlertDialog>`, conte os registros (`count: 'exact'`) e injete na copy.
- **Tooltip explica termo, não traduz.** "Medição" continua "medição"; o tooltip diz "cobrança parcial proporcional ao que foi executado no período".
- **Nunca use `alert()`, `confirm()`, `prompt()` nativos.** Use `Dialog` ou `AlertDialog` do design system.
- **Telas devem importar copy de `src/content/*Labels.ts`.** String literal em tela = lint warning futura.

## Referência rápida de tom

| Situação | Frase modelo |
|----------|--------------|
| Sucesso curto | "Salvo." / "Enviado." / "Aprovado." |
| Sucesso com objeto | "Medição registrada." / "Compra cancelada." |
| Erro recuperável | "Não consegui salvar agora. Tenta de novo em alguns segundos." |
| Erro de validação | "Informe a data prevista antes de salvar." |
| Erro fatal | "Algo travou aqui. Já registramos o problema; você pode atualizar a página." |
| Estado vazio neutro | "Nenhuma obra cadastrada ainda." |
| Estado vazio positivo | "Nenhuma pendência — tudo em dia." |
| Confirmação destrutiva | "Excluir [X] remove [N registros vinculados]. Não dá pra desfazer." |
| CTA primário | "Registrar medição" / "Aprovar agora" / "Convidar equipe" |
| CTA secundário | "Cancelar" / "Voltar" / "Ver detalhes" |

## Onde mora a copy

| Tipo | Arquivo |
|------|---------|
| Navegação (sidebar, breadcrumb) | `src/content/navigationLabels.ts` |
| Estado vazio | `src/content/emptyStateLabels.ts` |
| Erro | `src/content/errorLabels.ts` |
| Sucesso | `src/content/successLabels.ts` |
| Confirmação destrutiva | `src/content/confirmLabels.ts` |
| Onboarding por papel/fase | `src/content/onboardingFlows.ts` |
| Glossário de obra | `src/content/glossario.ts` |

Toda nova copy entra primeiro nesses arquivos, depois é importada nas telas. Strings literais em JSX são detectadas pelo `scripts/audit-strings.ts` e listadas em `docs/strings-orfas.md`.
