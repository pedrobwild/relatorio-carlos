import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Check, X, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface StageDates {
  proposed_start: string | null;
  proposed_end: string | null;
  confirmed_start: string | null;
  confirmed_end: string | null;
}

interface StageDatesPanelProps {
  stageId: string;
  projectId: string;
  dates: StageDates;
  isAdmin: boolean;
  stageName: string;
}

function DateField({
  label,
  value,
  icon: Icon,
  isConfirmed,
  onSelect,
  canEdit,
}: {
  label: string;
  value: string | null;
  icon: React.ElementType;
  isConfirmed?: boolean;
  onSelect: (date: Date | undefined) => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? parseISO(value) : undefined;

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 min-h-[40px]">
        <Icon className={cn(
          "h-4 w-4 shrink-0",
          isConfirmed ? "text-green-600" : "text-muted-foreground"
        )} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn(
            "text-sm font-medium",
            isConfirmed ? "text-green-700" : "text-foreground"
          )}>
            {parsedDate
              ? format(parsedDate, "dd 'de' MMM, yyyy", { locale: ptBR })
              : 'Em definição'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 min-h-[44px] w-full rounded-lg px-3 py-2 text-left transition-colors",
            "hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary",
            "border border-transparent hover:border-border"
          )}
        >
          <Icon className={cn(
            "h-4 w-4 shrink-0",
            isConfirmed ? "text-green-600" : "text-muted-foreground"
          )} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn(
              "text-sm font-medium",
              isConfirmed ? "text-green-700" : parsedDate ? "text-foreground" : "text-muted-foreground"
            )}>
              {parsedDate
                ? format(parsedDate, "dd 'de' MMM, yyyy", { locale: ptBR })
                : 'Selecionar data'}
            </p>
          </div>
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(date) => {
            onSelect(date);
            setOpen(false);
          }}
          className="p-3 pointer-events-auto"
          locale={ptBR}
        />
        {parsedDate && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                onSelect(undefined);
                setOpen(false);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function StageDatesPanel({
  stageId,
  projectId,
  dates,
  isAdmin,
  stageName,
}: StageDatesPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleDateChange = async (
    fieldName: keyof StageDates,
    newDate: Date | undefined
  ) => {
    const oldValue = dates[fieldName];
    const newValue = newDate ? format(newDate, 'yyyy-MM-dd') : null;

    if (oldValue === newValue) return;

    try {
      // Update the stage date
      const { error: updateError } = await supabase
        .from('journey_stages')
        .update({ [fieldName]: newValue })
        .eq('id', stageId);

      if (updateError) throw updateError;

      // Log the change
      const { error: logError } = await supabase
        .from('journey_stage_date_log')
        .insert({
          stage_id: stageId,
          project_id: projectId,
          field_name: fieldName,
          old_value: oldValue,
          new_value: newValue,
          changed_by: user?.id || null,
        });

      if (logError) {
        console.error('Failed to log date change:', logError);
      }

      queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
      toast.success('Data atualizada');
    } catch (error) {
      console.error('Error updating date:', error);
      toast.error('Erro ao atualizar data');
    }
  };

  const hasAnyDate = dates.proposed_start || dates.proposed_end || dates.confirmed_start || dates.confirmed_end;

  // Customers can edit proposed dates; admins can edit all dates
  const canEditProposed = true; // Both clients and admins
  const canEditConfirmed = isAdmin;

  if (!isAdmin && !hasAnyDate) return null;

  return (
    <div className="space-y-3 p-3 md:p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Datas da Etapa</h4>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* Proposed dates — client + admin can edit */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
            Proposta do cliente
          </p>
          <DateField
            label="Início proposto"
            value={dates.proposed_start}
            icon={Clock}
            onSelect={(date) => handleDateChange('proposed_start', date)}
            canEdit={canEditProposed}
          />
          <DateField
            label="Término proposto"
            value={dates.proposed_end}
            icon={Clock}
            onSelect={(date) => handleDateChange('proposed_end', date)}
            canEdit={canEditProposed}
          />
        </div>

        {/* Confirmed dates — admin only */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
            Confirmada pela Bwild
          </p>
          <DateField
            label="Início confirmado"
            value={dates.confirmed_start}
            icon={CheckCircle2}
            isConfirmed={!!dates.confirmed_start}
            onSelect={(date) => handleDateChange('confirmed_start', date)}
            canEdit={canEditConfirmed}
          />
          <DateField
            label="Término confirmado"
            value={dates.confirmed_end}
            icon={CheckCircle2}
            isConfirmed={!!dates.confirmed_end}
            onSelect={(date) => handleDateChange('confirmed_end', date)}
            canEdit={canEditConfirmed}
          />
        </div>
      </div>
    </div>
  );
}
