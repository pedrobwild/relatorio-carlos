# Corrigir perda de progresso do cronograma

## Diagnóstico confirmado
- O projeto do Marcos (`Península Vila Madalena - Apto 208 Torre 2 Isla`) mantém 20 atividades no banco, porém apenas 1 está iniciada e não há medições de avanço.
- Cada autosave atual chama `replace_project_activities`, que apaga todas as atividades e cria novas linhas com novos IDs.
- Como as medições referenciam as atividades com exclusão em cascata, qualquer autosave do cronograma apaga o histórico de avanço associado. Outros vínculos, como inspeções e compras, também perdem a associação.

## Implementação
1. Alterar a RPC `replace_project_activities` para atualizar atividades existentes pelo ID, inserir apenas atividades novas e remover somente as que realmente saíram do cronograma.
2. Enviar o ID de cada atividade existente no payload do frontend, preservando medições, inspeções, compras, responsáveis, baseline e demais metadados não editados nessa tela.
3. Remover o fallback destrutivo no hook: se a RPC falhar, o sistema deve informar a falha e manter os dados existentes, nunca executar delete/insert no cliente.
4. Proteger o autosave concorrente para que uma edição feita durante um salvamento gere uma gravação posterior, sem ser perdida ao atualizar a página.
5. Adicionar testes de regressão para IDs preservados, falha sem fallback destrutivo e salvamento posterior de mudanças concorrentes.

## Validação
- Aplicar a migration no backend.
- Rodar os testes direcionados e o build de produção.
- Abrir o cronograma do Marcos, alterar um campo controlado, aguardar “Salvo automaticamente”, recarregar e confirmar persistência sem mudança dos IDs.
