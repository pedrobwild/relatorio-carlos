import { CheckCircle2, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, type PartyRow, type AckRow } from "./types";

interface PartiesCardProps {
  parties: PartyRow[];
  acknowledgements: AckRow[];
  partiesSigned: number;
  partiesTotal: number;
}

export function PartiesCard({
  parties,
  acknowledgements,
  partiesSigned,
  partiesTotal,
}: PartiesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Partes Envolvidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {parties.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <p>Nenhuma parte cadastrada.</p>
            <p className="text-xs mt-1">
              As partes serão adicionadas quando a formalização for enviada para
              assinatura.
            </p>
          </div>
        ) : (
          parties.map((party) => {
            const ack = acknowledgements.find((a) => a.party_id === party.id);
            const isSigned = !!ack;
            return (
              <div
                key={party.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isSigned
                    ? "bg-success/10 border-success/30"
                    : "bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSigned ? (
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{party.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {party.role_label ||
                        (party.party_type === "customer"
                          ? "Cliente"
                          : "Empresa")}
                      {party.email && ` · ${party.email}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {isSigned ? (
                    <div>
                      <Badge
                        variant="outline"
                        className="bg-success/10 text-[hsl(var(--success))] border-success/30"
                      >
                        Assinado
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(ack!.acknowledged_at)}
                      </p>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-200"
                    >
                      Pendente
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}

        {parties.length > 0 && (
          <div className="pt-3 border-t mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progresso de assinaturas
              </span>
              <span className="font-medium">
                {partiesSigned}/{partiesTotal}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--success))] rounded-full transition-all duration-300"
                style={{
                  width: `${(partiesSigned / (partiesTotal || 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
