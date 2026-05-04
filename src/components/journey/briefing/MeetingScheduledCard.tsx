import { useMemo } from "react";
import { CalendarCheck, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { MeetingAvailability } from "@/hooks/useMeetingAvailability";

interface MeetingScheduledCardProps {
  availability: MeetingAvailability;
}

export function MeetingScheduledCard({
  availability,
}: MeetingScheduledCardProps) {
  const meetText = availability.meeting_details_text || "";

  const meetLink = useMemo(() => {
    const match = meetText.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
    return match ? match[0] : null;
  }, [meetText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(meetText).then(() => {
      toast.success("Detalhes copiados para a área de transferência.");
    });
  };

  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
            <CalendarCheck className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Reunião Agendada
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Confira os detalhes da sua Reunião de Briefing abaixo.
            </p>
          </div>
        </div>

        {/* Meeting details block — preserve line breaks exactly as pasted */}
        <div className="pl-11">
          <pre className="whitespace-pre-wrap break-words text-sm text-foreground bg-muted/40 rounded-lg p-4 border border-border font-sans leading-relaxed">
            {meetText}
          </pre>
        </div>

        {/* Utility buttons */}
        <div className="flex flex-wrap gap-2 pl-11">
          <Button
            variant="outline"
            size="sm"
            className="h-10 min-h-[44px] gap-1.5 text-xs"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar detalhes
          </Button>
          {meetLink && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 min-h-[44px] gap-1.5 text-xs"
              asChild
            >
              <a href={meetLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir Google Meet
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
