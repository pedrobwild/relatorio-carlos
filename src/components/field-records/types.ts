/**
 * Tipos compartilhados pelos componentes de Field Records.
 *
 * Field Record = "evento de campo" registrado pela equipe de obra:
 *  - NC (não conformidade)
 *  - Inspeção / vistoria
 *  - Atividade (registro pontual no campo)
 *
 * Cada `kind` reusa o mesmo scaffold visual (header + bloco de mídia +
 * geolocalização + severidade + responsável + descrição) e injeta seus
 * campos específicos via slot `extraFields`.
 */
export type FieldRecordKind = 'nc' | 'inspection' | 'activity';

export const FIELD_RECORD_KIND_LABEL: Record<FieldRecordKind, string> = {
  nc: 'Não conformidade',
  inspection: 'Vistoria',
  activity: 'Atividade',
};

export type FieldRecordSeverity = 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_LABEL: Record<FieldRecordSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

/** Ponto geográfico simples (sem altitude). */
export interface FieldRecordLocation {
  latitude: number;
  longitude: number;
  /** Nota textual do local (ex.: "Cozinha — bancada lateral"). Opcional. */
  note?: string;
  /** Precisão em metros, se vinda do navigator.geolocation. */
  accuracy?: number;
}

export interface FieldRecordMedia {
  /** Arquivo bruto (não persistido). Quem faz upload é o consumidor. */
  file: File;
  /** Object URL gerado para preview. Limpar com URL.revokeObjectURL. */
  previewUrl: string;
  type: 'image' | 'video';
}
