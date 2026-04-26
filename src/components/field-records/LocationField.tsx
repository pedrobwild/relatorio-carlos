/**
 * Campo de geolocalização para Field Records.
 *
 * Pré-preenche com `navigator.geolocation` quando disponível (1 toque) e
 * permite anotar uma referência textual ("Cozinha — bancada lateral").
 * Coordenadas são opcionais — quem registra pode descrever apenas o
 * local sem GPS.
 *
 * Estados:
 *  - `idle`:        sem captura ainda; mostra botão "Capturar GPS"
 *  - `capturing`:   pedindo localização ao navegador
 *  - `error`:       permissão negada / sem suporte
 *  - `captured`:    coordenadas presentes
 */
import { useState } from 'react';
import { MapPin, Loader2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FieldRecordLocation } from './types';

interface LocationFieldProps {
  value: FieldRecordLocation | null;
  onChange: (location: FieldRecordLocation | null) => void;
  label?: string;
  className?: string;
  /** Tempo máximo aguardando o GPS (ms). Default 8s. */
  timeoutMs?: number;
}

type CaptureState = 'idle' | 'capturing' | 'error';

export function LocationField({
  value,
  onChange,
  label = 'Localização',
  className,
  timeoutMs = 8000,
}: LocationFieldProps) {
  const [state, setState] = useState<CaptureState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCapture = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('error');
      setErrorMsg('Geolocalização não disponível neste dispositivo.');
      return;
    }
    setState('capturing');
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          note: value?.note ?? '',
        });
        setState('idle');
      },
      (err) => {
        setState('error');
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? 'Permissão de localização negada.'
            : 'Não foi possível obter a localização.',
        );
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  };

  const handleClear = () => {
    onChange(null);
    setState('idle');
    setErrorMsg(null);
  };

  const handleNote = (note: string) => {
    if (value) {
      onChange({ ...value, note });
    } else if (note.trim()) {
      // Permite registrar só o ponto de referência textual.
      onChange({ latitude: 0, longitude: 0, note });
    }
  };

  const hasCoords = !!value && (value.latitude !== 0 || value.longitude !== 0);

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>

      <div className="flex items-center gap-2">
        {hasCoords ? (
          <div className="flex-1 inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-muted/30 text-xs">
            <MapPin className="h-3.5 w-3.5 text-success shrink-0" />
            <span className="tabular-nums truncate">
              {value!.latitude.toFixed(5)}, {value!.longitude.toFixed(5)}
            </span>
            {value!.accuracy != null && (
              <span className="text-muted-foreground shrink-0">
                · ±{Math.round(value!.accuracy)}m
              </span>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 ml-auto shrink-0"
              onClick={handleClear}
              aria-label="Remover coordenadas"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCapture}
            disabled={state === 'capturing'}
            className="h-9 gap-1.5 text-xs"
          >
            {state === 'capturing' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
            Capturar GPS
          </Button>
        )}
      </div>

      <Input
        value={value?.note ?? ''}
        onChange={(e) => handleNote(e.target.value)}
        placeholder="Referência textual (opcional)"
        className="h-9 text-sm"
      />

      {state === 'error' && errorMsg && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {errorMsg}
        </p>
      )}
    </div>
  );
}
