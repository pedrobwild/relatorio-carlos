import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FORMALIZATION_TYPE_LABELS,
  FORMALIZATION_STATUS_LABELS,
  type FormalizationType,
  type FormalizationStatus,
} from "@/types/formalization";
import {
  getStatusIcon,
  getStatusBadgeVariant,
  getTypeIcon,
  formatFormalizationDate as formatDate,
} from "@/lib/formalizationHelpers";

interface FormalizacaoData {
  id: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  type: string | null;
  locked_at: string | null;
  created_at: string | null;
  parties_signed: number | null;
  parties_total: number | null;
}

const statusColorMap: Record<string, string> = {
  signed: "bg-green-500",
  pending_signatures: "bg-amber-500",
  voided: "bg-destructive",
};

interface FormalizacaoCardProps {
  formalizacao: FormalizacaoData;
  basePath: string;
  index?: number;
  showStatusLabel?: boolean;
}

export function FormalizacaoCard({
  formalizacao,
  basePath,
  index = 0,
  showStatusLabel = true,
}: FormalizacaoCardProps) {
  return (
    <Link
      to={`${basePath}/${formalizacao.id}`}
      className="block group animate-fade-in opacity-0"
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: "forwards",
      }}
    >
      <Card className="h-full group-hover:border-primary/50 group-hover:shadow-sm transition-all duration-200 overflow-hidden">
        <CardContent className="p-0">
          <div
            className={`h-1 ${(formalizacao.status && statusColorMap[formalizacao.status]) || "bg-muted"}`}
          />

          <div className="p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1 flex-1 min-w-0">
                {formalizacao.title}
              </h3>
              <Badge
                variant={getStatusBadgeVariant(
                  formalizacao.status as FormalizationStatus,
                )}
                className="text-xs gap-1 shrink-0"
              >
                {getStatusIcon(formalizacao.status as FormalizationStatus)}
                {showStatusLabel &&
                  FORMALIZATION_STATUS_LABELS[
                    formalizacao.status as FormalizationStatus
                  ]}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs font-normal gap-1 px-1.5 py-0 bg-background"
              >
                <span role="img" aria-label={formalizacao.type || ""}>
                  {getTypeIcon(formalizacao.type as FormalizationType)}
                </span>
                {
                  FORMALIZATION_TYPE_LABELS[
                    formalizacao.type as FormalizationType
                  ]
                }
              </Badge>
              <span>•</span>
              <span>
                {formalizacao.locked_at
                  ? `Travado ${formatDate(formalizacao.locked_at)}`
                  : formatDate(formalizacao.created_at)}
              </span>
              {formalizacao.parties_signed !== null &&
                formalizacao.parties_total !== null && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {formalizacao.parties_signed}/{formalizacao.parties_total}
                    </span>
                  </>
                )}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-1">
              {formalizacao.summary}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function FormalizacaoSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <div className="flex items-center justify-between pt-2 border-t">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}
