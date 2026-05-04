import { useState, useMemo } from'react';
import { format } from'date-fns';
import { ptBR } from'date-fns/locale';
import { CalendarIcon, Clock, Info, Send, Loader2 } from'lucide-react';
import { Card, CardContent } from'@/components/ui/card';
import { Button } from'@/components/ui/button';
import { Textarea } from'@/components/ui/textarea';
import { Calendar } from'@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from'@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from'@/components/ui/tooltip';
import { cn } from'@/lib/utils';
import { isWeekend, countBusinessDaysInclusive, getMinStartDate } from'@/lib/businessDays';
import { useSubmitMeetingAvailability } from'@/hooks/useMeetingAvailability';
import { useAuth } from'@/hooks/useAuth';

const WEEKDAYS = [
 { key:'MON', label:'Seg' },
 { key:'TUE', label:'Ter' },
 { key:'WED', label:'Qua' },
 { key:'THU', label:'Qui' },
 { key:'FRI', label:'Sex' },
] as const;

const TIME_SLOTS = [
 { key:'09_12', label:'09:00–12:00' },
 { key:'13_18', label:'13:00–18:00' },
 { key:'18_20', label:'18:00–20:00' },
] as const;

interface MeetingAvailabilityFormProps {
 stageId: string;
 projectId: string;
 isEditing: boolean;
 onCancel?: () => void;
 onSuccess?: () => void;
 initialData?: {
 start_date: string;
 end_date: string;
 preferred_weekdays: string[];
 time_slots: string[];
 notes: string | null;
 };
}

export function MeetingAvailabilityForm({ stageId, projectId, isEditing, onCancel, onSuccess, initialData }: MeetingAvailabilityFormProps) {
 const { user } = useAuth();
 const submitAvailability = useSubmitMeetingAvailability();

 const [startDate, setStartDate] = useState<Date | undefined>(
 initialData ? new Date(initialData.start_date +'T00:00:00') : undefined
 );
 const [endDate, setEndDate] = useState<Date | undefined>(
 initialData ? new Date(initialData.end_date +'T00:00:00') : undefined
 );
 const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>(initialData?.preferred_weekdays ?? []);
 const [selectedSlots, setSelectedSlots] = useState<string[]>(initialData?.time_slots ?? []);
 const [notes, setNotes] = useState(initialData?.notes ??'');
 const [errors, setErrors] = useState<string[]>([]);

 const minDate = useMemo(() => getMinStartDate(), []);

 const disabledStartDays = useMemo(() => (date: Date) => {
 if (isWeekend(date)) return true;
 const d = new Date(date); d.setHours(0, 0, 0, 0);
 const min = new Date(minDate); min.setHours(0, 0, 0, 0);
 return d < min;
 }, [minDate]);

 const disabledEndDays = useMemo(() => (date: Date) => {
 if (isWeekend(date)) return true;
 const d = new Date(date); d.setHours(0, 0, 0, 0);
 const min = new Date(minDate); min.setHours(0, 0, 0, 0);
 if (d < min) return true;
 if (startDate) {
 const minEnd = new Date(startDate); minEnd.setHours(0, 0, 0, 0);
 minEnd.setDate(minEnd.getDate() + 3);
 if (d < minEnd) return true;
 }
 return false;
 }, [minDate, startDate]);

 const weekdayWarning = useMemo(() => {
 if (!startDate || !endDate || selectedWeekdays.length === 0) return null;
 const dayMap: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5 };
 const daysInRange = new Set<number>();
 const cursor = new Date(startDate);
 while (cursor <= endDate) {
 if (!isWeekend(cursor)) daysInRange.add(cursor.getDay());
 cursor.setDate(cursor.getDate() + 1);
 }
 const outside = selectedWeekdays.filter(wd => !daysInRange.has(dayMap[wd]));
 if (outside.length > 0) return'Alguns dias selecionados não estão dentro do intervalo escolhido.';
 return null;
 }, [startDate, endDate, selectedWeekdays]);

 const validate = (): boolean => {
 const errs: string[] = [];
 if (!startDate) errs.push('Selecione uma data inicial.');
 if (!endDate) errs.push('Selecione uma data final.');
 if (startDate && endDate) {
 const bdays = countBusinessDaysInclusive(startDate, endDate);
 if (bdays > 7) errs.push('Selecione no máximo 7 dias úteis.');
 if (bdays === 0) errs.push('O intervalo deve conter pelo menos 1 dia útil.');
 }
 if (startDate) {
 const min = new Date(minDate); min.setHours(0, 0, 0, 0);
 const s = new Date(startDate); s.setHours(0, 0, 0, 0);
 if (s < min) errs.push('Escolha uma data a partir de 2 dias úteis de hoje.');
 }
 if (selectedSlots.length === 0) errs.push('Selecione pelo menos um período de horário.');
 setErrors(errs);
 return errs.length === 0;
 };

 const handleSubmit = () => {
 if (!validate() || !user) return;
 submitAvailability.mutate(
 {
 stage_id: stageId,
 project_id: projectId,
 submitted_by: user.id,
 start_date: format(startDate!,'yyyy-MM-dd'),
 end_date: format(endDate!,'yyyy-MM-dd'),
 preferred_weekdays: selectedWeekdays,
 time_slots: selectedSlots,
 notes: notes.trim() || undefined,
 },
 { onSuccess: () => onSuccess?.() },
 );
 };

 const toggleChip = (key: string, list: string[], setList: (v: string[]) => void) => {
 setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
 };

 return (
 <Card>
 <CardContent className="pt-6 space-y-5">
 <div className="flex items-start gap-3">
 <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
 <CalendarIcon className="h-4 w-4 text-primary" />
 </div>
 <div>
 <h3 className="text-sm font-semibold text-foreground">Sua disponibilidade para a Reunião de Briefing</h3>
 <p className="text-xs text-muted-foreground mt-0.5">
 Selecione um intervalo de datas e os horários do dia em que você pode. A equipe de Arquitetura agenda conforme a disponibilidade e confirma aqui no portal.
 </p>
 </div>
 </div>

 <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
 <div className="flex items-center gap-2">
 <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
 <span className="text-xs font-medium text-foreground">Como funciona</span>
 </div>
 <ul className="space-y-1 text-xs text-muted-foreground pl-5.5">
 <li>Escolha um intervalo de até 7 dias úteis.</li>
 <li>
 Disponível a partir de 2{''}
 <TooltipProvider>
 <Tooltip>
 <TooltipTrigger asChild>
 <span className="underline decoration-dotted cursor-help">dias úteis</span>
 </TooltipTrigger>
 <TooltipContent>
 <p className="text-xs">Dias úteis = segunda a sexta. Fins de semana não entram no cálculo.</p>
 </TooltipContent>
 </Tooltip>
 </TooltipProvider>
 {''}de hoje.
 </li>
 <li>Sábados e domingos não estão disponíveis.</li>
 </ul>
 </div>

 <div className="grid gap-3 sm:grid-cols-2">
 <DatePickerField label="Data inicial" date={startDate} onSelect={d => { setStartDate(d); setErrors([]); }} disabled={disabledStartDays} minDate={minDate} />
 <DatePickerField label="Data final" date={endDate} onSelect={d => { setEndDate(d); setErrors([]); }} disabled={disabledEndDays} minDate={startDate || minDate} />
 </div>
 <p className="text-xs text-muted-foreground -mt-2">Fins de semana aparecem bloqueados e não entram na contagem do período.</p>

 <div className="space-y-2">
 <label className="text-sm font-medium text-foreground">Quais dias da semana são melhores? <span className="text-muted-foreground font-normal">(opcional)</span></label>
 <p className="text-xs text-muted-foreground -mt-1">Isso ajuda a equipe a priorizar dentro do seu intervalo.</p>
 <div className="flex flex-wrap gap-2">
 {WEEKDAYS.map(({ key, label }) => (
 <button key={key} type="button"
 className={cn('h-10 px-4 rounded-full border text-sm font-medium transition-colors min-h-[44px]',
 selectedWeekdays.includes(key) ?'bg-primary text-primary-foreground border-primary' :'bg-background text-foreground border-border hover:bg-muted')}
 onClick={() => toggleChip(key, selectedWeekdays, setSelectedWeekdays)}>
 {label}
 </button>
 ))}
 </div>
 {weekdayWarning && <p className="text-xs text-amber-600">{weekdayWarning}</p>}
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-foreground">
 <Clock className="h-3.5 w-3.5 inline mr-1.5" />Em quais horários é melhor para você?
 </label>
 <p className="text-xs text-muted-foreground -mt-1">Selecione um ou mais períodos.</p>
 <div className="flex flex-wrap gap-2">
 {TIME_SLOTS.map(({ key, label }) => (
 <button key={key} type="button"
 className={cn('h-10 px-4 rounded-full border text-sm font-medium transition-colors min-h-[44px]',
 selectedSlots.includes(key) ?'bg-primary text-primary-foreground border-primary' :'bg-background text-foreground border-border hover:bg-muted')}
 onClick={() => { toggleChip(key, selectedSlots, setSelectedSlots); setErrors([]); }}>
 {label}
 </button>
 ))}
 </div>
 </div>

 <div className="space-y-1.5">
 <label htmlFor="availability-notes" className="text-sm font-medium text-foreground">
 Observações <span className="text-muted-foreground font-normal">(opcional)</span>
 </label>
 <Textarea id="availability-notes" placeholder="Ex.: prefiro vídeo / tenho restrição após 19h / etc." value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm" maxLength={500} />
 </div>

 {errors.length > 0 && (
 <div className="space-y-1">
 {errors.map((err, i) => <p key={i} className="text-xs text-destructive">{err}</p>)}
 </div>
 )}

 <div className="flex gap-2">
 {isEditing && onCancel && (
 <Button variant="outline" className="h-12 min-h-[44px]" onClick={onCancel}>Cancelar</Button>
 )}
 <Button className="h-12 min-h-[44px] flex-1 gap-2" onClick={handleSubmit} disabled={submitAvailability.isPending}>
 {submitAvailability.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
 {isEditing ?'Atualizar disponibilidade' :'Registrar disponibilidade'}
 </Button>
 </div>
 </CardContent>
 </Card>
 );
}

function DatePickerField({ label, date, onSelect, disabled, minDate }: {
 label: string; date: Date | undefined; onSelect: (d: Date | undefined) => void;
 disabled: (date: Date) => boolean; minDate: Date;
}) {
 return (
 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">{label}</label>
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-11 min-h-[44px]', !date &&'text-muted-foreground')}>
 <CalendarIcon className="h-4 w-4 mr-2" />
 {date ? format(date,"dd'de' MMMM", { locale: ptBR }) :'Selecionar data'}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar mode="single" selected={date} onSelect={onSelect} disabled={disabled} defaultMonth={minDate} className="p-3 pointer-events-auto" />
 </PopoverContent>
 </Popover>
 </div>
 );
}
