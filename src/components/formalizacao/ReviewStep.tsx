import { useMemo } from "react";
import { User, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FORMALIZATION_TYPE_LABELS,
  type FormalizationType,
} from "@/types/formalization";
import DOMPurify from "dompurify";

interface ReviewStepProps {
  formData: {
    type: FormalizationType | null;
    title: string;
    summary: string;
    body_md: string;
    data: Record<string, unknown>;
    parties: Array<{
      party_type: "customer" | "company";
      display_name: string;
      email: string;
      role_label?: string;
      must_sign: boolean;
    }>;
  };
  onSubmit: (sendNow: boolean) => void;
  isSubmitting: boolean;
}

export function ReviewStep({
  formData,
  onSubmit,
  isSubmitting,
}: ReviewStepProps) {
  const customerParties = formData.parties.filter(
    (p) => p.party_type === "customer",
  );
  const companyParties = formData.parties.filter(
    (p) => p.party_type === "company",
  );

  // BUG FIX: Sanitiza HTML para prevenir XSS
  const sanitizedBody = useMemo(() => {
    const htmlContent = formData.body_md.replace(/\n/g, "<br>");
    return DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: [
        "b",
        "i",
        "em",
        "strong",
        "br",
        "p",
        "ul",
        "ol",
        "li",
        "a",
        "span",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
    });
  }, [formData.body_md]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-h2">Revisar e Enviar</h2>
        <p className="text-caption mt-1">
          Confira as informações antes de enviar para ciência
        </p>
      </div>

      {/* Document info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-h3">{formData.title}</CardTitle>
            <Badge variant="outline">
              {FORMALIZATION_TYPE_LABELS[formData.type!]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-caption">{formData.summary}</p>

          <Separator />

          <div
            className="prose prose-sm max-w-none text-body [&_*]:!font-[inherit] [&_span]:!text-inherit"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />
        </CardContent>
      </Card>

      {/* Parties */}
      <Card>
        <CardHeader>
          <CardTitle className="text-h3">Partes Envolvidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-primary" />
              <span className="text-body font-medium">Cliente</span>
            </div>
            <div className="space-y-2">
              {customerParties.map((party, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="text-body font-medium">
                      {party.display_name}
                    </p>
                    <p className="text-tiny">{party.email}</p>
                  </div>
                  {party.must_sign && (
                    <Badge variant="secondary" className="text-tiny">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Assina
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Company */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-body font-medium">Empresa</span>
            </div>
            <div className="space-y-2">
              {companyParties.map((party, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="text-body font-medium">
                      {party.display_name}
                    </p>
                    <p className="text-tiny">{party.email}</p>
                  </div>
                  {party.must_sign && (
                    <Badge variant="secondary" className="text-tiny">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Assina
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <p className="text-caption">
            <strong className="text-foreground">Importante:</strong> Após enviar
            para ciência, o conteúdo será travado e não poderá ser alterado. As
            partes receberão notificação para dar ciência.
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1 min-h-[44px]"
          onClick={() => onSubmit(false)}
          disabled={isSubmitting}
          aria-label="Salvar como rascunho"
        >
          Salvar Rascunho
        </Button>
        <Button
          className="flex-1 min-h-[44px]"
          onClick={() => onSubmit(true)}
          disabled={isSubmitting}
          aria-label="Enviar para ciência"
        >
          {isSubmitting ? "Enviando..." : "Enviar para Ciência"}
        </Button>
      </div>
    </div>
  );
}
