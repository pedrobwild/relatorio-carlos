export type InspectionType ='rotina' |'recebimento_etapa' |'entrega_cliente' |'seguranca' |'pos_chuva' |'garantia';

export const INSPECTION_TYPES: { value: InspectionType; label: string; emoji: string; color: string }[] = [
 { value:'rotina', label:'Rotina / Semanal', emoji:'🔄', color:'bg-blue-100 text-blue-700' },
 { value:'recebimento_etapa', label:'Recebimento de Etapa', emoji:'✅', color:'bg-green-100 text-green-700' },
 { value:'entrega_cliente', label:'Entrega ao Cliente', emoji:'🏠', color:'bg-purple-100 text-purple-700' },
 { value:'seguranca', label:'Segurança do Trabalho', emoji:'⛑️', color:'bg-red-100 text-red-700' },
 { value:'pos_chuva', label:'Pós-Chuva / Emergência', emoji:'🌧️', color:'bg-cyan-100 text-cyan-700' },
 { value:'garantia', label:'Garantia (Pós-Entrega)', emoji:'🛡️', color:'bg-orange-100 text-orange-700' },
];

export function getInspectionTypeConfig(type: string) {
 return INSPECTION_TYPES.find(t => t.value === type) ?? INSPECTION_TYPES[0];
}

export function getInspectionTypeLabel(type: string): string {
 const config = getInspectionTypeConfig(type);
 return`${config.emoji} ${config.label}`;
}

/** Map inspection types to template categories for auto-loading */
export const TYPE_TO_TEMPLATE_CATEGORY: Partial<Record<InspectionType, string>> = {
 rotina:'Checklist Geral',
 seguranca:'Segurança',
 recebimento_etapa:'Recebimento',
 entrega_cliente:'Entrega',
 pos_chuva:'Pós-Chuva',
 garantia:'Garantia',
};
