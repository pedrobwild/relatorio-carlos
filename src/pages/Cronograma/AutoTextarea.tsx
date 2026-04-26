import { useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface AutoTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
}

export function AutoTextarea({
  value,
  onChange,
  placeholder,
  hasError,
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = '0px';
      ref.current.style.height = `${Math.max(36, ref.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={cn(
        'min-h-[36px] resize-none overflow-hidden py-2 px-2.5 text-sm leading-snug border-transparent bg-transparent hover:border-border focus:border-border transition-colors',
        hasError && 'border-destructive',
      )}
    />
  );
}
