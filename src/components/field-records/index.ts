/**
 * Surface pública do módulo de Field Records.
 *
 * Cada feature de campo (NC, Vistoria, Atividade) deve consumir esses
 * primitivos em vez de duplicar dropdown de severidade, responsável etc.
 */
export { FieldRecordDialog } from './FieldRecordDialog';
export type { FieldRecordValues, FieldRecordEnabledFields } from './FieldRecordDialog';
export { SeverityField } from './SeverityField';
export { AssigneeField } from './AssigneeField';
export { LocationField } from './LocationField';
export { MediaUploader, buildMedia } from './MediaUploader';
export {
  FIELD_RECORD_KIND_LABEL,
  SEVERITY_LABEL,
  type FieldRecordKind,
  type FieldRecordSeverity,
  type FieldRecordLocation,
  type FieldRecordMedia,
} from './types';
