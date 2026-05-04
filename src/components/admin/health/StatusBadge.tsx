import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DiagnosticResult } from "@/infra/repositories/diagnostics.repository";

const config = {
  ok: {
    variant: "default" as const,
    icon: CheckCircle,
    label: "OK",
    className: "bg-green-500 hover:bg-green-600",
  },
  warn: {
    variant: "secondary" as const,
    icon: AlertTriangle,
    label: "WARN",
    className: "bg-yellow-500 hover:bg-yellow-600 text-black",
  },
  fail: {
    variant: "destructive" as const,
    icon: XCircle,
    label: "FAIL",
    className: "",
  },
};

export const StatusBadge = ({
  status,
}: {
  status: DiagnosticResult["status"];
}) => {
  const { icon: Icon, label, className, variant } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
};
