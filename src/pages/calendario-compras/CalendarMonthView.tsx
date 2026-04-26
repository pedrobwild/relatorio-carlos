/**
 * Visão "Calendário" das compras: grid 7x do mês com até 3 chips de compra
 * por dia (excedente vira "+N mais").
 */
import { eachDayOfInterval, endOfMonth, format, isSameDay, isWeekend, startOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { calendarStatusConfig, toCalendarStatus, type PurchaseWithProject } from './types';

interface CalendarMonthViewProps {
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  purchasesByDate: Map<string, PurchaseWithProject[]>;
}

export function CalendarMonthView({ currentMonth, setCurrentMonth, purchasesByDate }: CalendarMonthViewProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
          ))}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayPurchases = purchasesByDate.get(dateStr) || [];
            const isToday = isSameDay(day, new Date());
            const weekend = isWeekend(day);
            return (
              <div
                key={dateStr}
                className={cn(
                  'bg-background p-1.5 min-h-[80px] text-xs',
                  isToday && 'ring-2 ring-primary ring-inset',
                  weekend && 'bg-muted/40',
                )}
              >
                <span className={cn('font-medium', isToday && 'text-primary')}>{format(day, 'd')}</span>
                <div className="mt-1 space-y-0.5">
                  {dayPurchases.slice(0, 3).map((p) => {
                    const cs = toCalendarStatus(p.status);
                    const cfg = calendarStatusConfig[cs];
                    return (
                      <div
                        key={p.id}
                        className={cn('text-[10px] leading-tight rounded-sm px-1 py-0.5 truncate border', cfg.color)}
                        title={`${p.project_name} — ${p.item_name}`}
                      >
                        {p.item_name}
                      </div>
                    );
                  })}
                  {dayPurchases.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dayPurchases.length - 3} mais</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
