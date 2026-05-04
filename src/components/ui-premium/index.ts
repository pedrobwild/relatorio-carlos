/**
 * ui-premium — Design System refinado (Linear/Stripe/Notion-inspired).
 *
 * Não substitui o shadcn (ui/), complementa com primitives de mais alto
 * nível para páginas internas e dashboards. Todos os tokens vêm de
 * src/index.css — nada hardcoded.
 */
export { PageHeader } from './PageHeader';
export { PageToolbar } from './PageToolbar';
export { MetricCard, MetricRail, type MetricAccent } from './MetricCard';
export { SectionCard } from './SectionCard';
export {
  StatusBadge,
  type StatusTone,
  type StatusVariant,
  type StatusSize,
} from './StatusBadge';
export { FilterPill } from './FilterPill';
export {
  DataTable,
  type DataTableColumn,
  type SortState,
  type ColumnAlign,
  type TableDensity,
} from './DataTable';
export {
  useTablePreferences,
  type TablePreferencesState,
  type UseTablePreferencesOptions,
  type UseTablePreferencesReturn,
} from './useTablePreferences';
export { DataTableSettings } from './DataTableSettings';
export { EmptyState } from './EmptyState';
export {
  SkeletonBlock,
  TableSkeleton,
  CardsSkeleton,
  MetricRailSkeleton,
  PageSkeleton,
} from './LoadingState';
export {
  PremiumDialogHeader,
  PremiumSheetHeader,
  PremiumDialogFooter,
  PremiumDialogBody,
} from './PremiumDialogHeader';
export { Glossary, type GlossaryProps } from './Glossary';
