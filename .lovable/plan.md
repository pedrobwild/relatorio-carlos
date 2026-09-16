# Renomear gestor para coordenador

## Alterações
- Trocar “gestor da obra” por “coordenador da obra” em todos os seletores, avisos, filtros, cartões e textos internos relacionados.
- Manter a responsabilidade como um único vínculo por obra, usando o campo existente.
- Restringir as opções dos seletores de coordenador a Gabriella Franco e Bruna Sampaio, sem limitar as listas de responsáveis usadas por outros recursos.
- Preservar a exibição do coordenador atual em obras existentes, inclusive durante a transição, para evitar nomes vazios.
- Atualizar os testes afetados e incluir cobertura para garantir que nenhuma outra pessoa apareça como opção de coordenador.

## Detalhes técnicos
- Criar um filtro reutilizável no hook de pessoas internas para expor apenas as duas coordenadoras elegíveis.
- Aplicar esse filtro no cadastro, edição, cabeçalhos, drawer e cartões editáveis do Painel de Obras.
- Não alterar o banco nem migrar vínculos já existentes; a coluna única atual continua sendo a fonte de verdade.
- Validar testes direcionados, checagem de tipos e o build automático do preview.
