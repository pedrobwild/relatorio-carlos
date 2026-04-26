import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { HubSectionMeta } from '@/config/obraHub';
import type { SectionStatus } from '@/hooks/useObraHubStatus';
import { cn } from '@/lib/utils';

interface HubSectionProps {
  meta: HubSectionMeta;
  to: string;
  status?: SectionStatus;
}

export function HubSection({ meta, to, status }: HubSectionProps) {
  const Icon = meta.icon;
  const sublabel = status?.sublabel;

  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 w-full px-3 min-h-[64px] py-2.5',
        'rounded-xl transition-colors',
        'hover:bg-muted/60 active:scale-[0.99]'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center h-10 w-10 rounded-xl shrink-0',
          status?.isUrgent
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">
            {meta.label}
          </span>
        </div>
        {sublabel && (
          <span
            className={cn(
              'text-xs leading-tight truncate block',
              status?.isUrgent ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {sublabel}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
    </Link>
  );
}
