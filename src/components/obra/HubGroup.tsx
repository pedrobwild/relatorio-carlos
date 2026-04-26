import { HubSection } from './HubSection';
import {
  HUB_SECTIONS,
  type HubGroupConfig,
  type HubSectionId,
} from '@/config/obraHub';
import type { SectionStatus, ObraHubStatus } from '@/hooks/useObraHubStatus';
import type { useProjectNavigation } from '@/hooks/useProjectNavigation';

type Paths = ReturnType<typeof useProjectNavigation>['paths'];

interface HubGroupProps {
  group: HubGroupConfig;
  paths: Paths;
  statusById: ObraHubStatus['byId'];
}

export function HubGroup({ group, paths, statusById }: HubGroupProps) {
  return (
    <section aria-labelledby={`hub-group-${group.id}`}>
      <h2
        id={`hub-group-${group.id}`}
        className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5"
      >
        {group.label}
      </h2>
      <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
        {group.items.map((id, index) => {
          const meta = HUB_SECTIONS[id as HubSectionId];
          const status: SectionStatus | undefined = statusById[id as HubSectionId];
          return (
            <div
              key={id}
              className={index > 0 ? 'border-t border-border/40' : undefined}
            >
              <HubSection meta={meta} to={meta.to(paths)} status={status} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
