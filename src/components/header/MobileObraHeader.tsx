import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronDown } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserRole } from '@/hooks/useUserRole';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { Button } from '@/components/ui/button';
import { ProjectSwitcherSheet } from '@/components/mobile/ProjectSwitcherSheet';
import { MobileNotificationsSheet } from '@/components/mobile/MobileNotificationsSheet';
import { resolveSectionLabel, isObraLandingRoute } from '@/config/sectionLabels';
import { cn } from '@/lib/utils';

/**
 * MobileObraHeader — slim sticky header (max 52px) for project-scoped mobile
 * routes. Replaces the heavy `MobileReportHeader` top bar and is rendered by
 * `ProjectShell` so it appears uniformly across Hub, Jornada, Painel,
 * Cronograma, Documentos, Pendências, Financeiro, etc.
 */
export function MobileObraHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { project } = useProject();
  const { projectId } = useProjectNavigation();
  const { isStaff } = useUserRole();
  const { data: projects = [] } = useProjectsQuery();
  const { unreadCount } = useNotifications();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const otherProjects = useMemo(
    () => projects.filter((p) => p.id !== projectId),
    [projects, projectId]
  );

  if (!projectId) return null;

  const sectionLabel = resolveSectionLabel(location.pathname);
  const isLanding = isObraLandingRoute(location.pathname);
  const projectName = project?.name || 'Carregando...';
  const unitName = project?.unit_name || '';
  const clientName = project?.customer_name;

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
  };

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-30 h-12 bg-card/95 backdrop-blur-xl backdrop-saturate-150 border-b border-border/60 flex items-center px-2"
        aria-label="Cabeçalho da obra"
      >
        {!isLanding ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-10 w-10 min-h-[44px] min-w-[44px] shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-10 shrink-0" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="flex-1 min-w-0 flex flex-col items-center justify-center px-1 py-1 rounded-lg active:bg-muted/40 transition-colors"
          aria-label="Trocar de obra"
        >
          <span className="flex items-center gap-1 text-sm font-semibold text-foreground truncate max-w-full">
            <span className="truncate">{projectName}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
          </span>
          {sectionLabel && (
            <span className="text-[11px] text-muted-foreground leading-tight truncate max-w-full">
              › {sectionLabel}
            </span>
          )}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNotificationsOpen(true)}
          className="relative h-10 w-10 min-h-[44px] min-w-[44px] shrink-0"
          aria-label={
            unreadCount > 0
              ? `Notificações (${unreadCount} não lidas)`
              : 'Notificações'
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full',
                'bg-destructive text-destructive-foreground text-[10px] font-bold',
                'flex items-center justify-center'
              )}
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </header>

      <ProjectSwitcherSheet
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        currentProjectName={projectName}
        unitName={unitName}
        clientName={clientName}
        otherProjects={otherProjects}
        onProjectSwitch={(id) => {
          setSwitcherOpen(false);
          navigate(`/obra/${id}/hub`);
        }}
      />

      <MobileNotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />
    </>
  );
}
