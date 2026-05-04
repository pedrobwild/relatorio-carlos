import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function MeetingAwaitingCard() {
  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center mt-0.5">
            <Clock className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Disponibilidade registrada
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Em breve o time de Arquitetura irá agendar a reunião. Por
              enquanto, basta aguardar.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
