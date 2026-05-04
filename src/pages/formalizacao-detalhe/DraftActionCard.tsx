import { FileText, Send, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DraftActionCardProps {
  hasParties: boolean;
  sendingForSignature: boolean;
  onSendForSignature: () => void;
}

export function DraftActionCard({
  hasParties,
  sendingForSignature,
  onSendForSignature,
}: DraftActionCardProps) {
  return (
    <Card className="border-blue-500/50 bg-blue-50/50">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-medium text-blue-900">Rascunho</h3>
              <p className="text-sm text-blue-700 mt-1">
                Este documento ainda está em rascunho e pode ser editado. Para
                coletar assinaturas, envie-o para as partes envolvidas.
              </p>
            </div>
            {!hasParties && (
              <div className="flex items-center gap-2 p-3 bg-blue-100/50 rounded-md">
                <UserPlus className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-700">
                  Adicione as partes envolvidas antes de enviar para assinatura.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                onClick={onSendForSignature}
                disabled={!hasParties || sendingForSignature}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendingForSignature ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {sendingForSignature ? "Enviando..." : "Enviar para assinatura"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
