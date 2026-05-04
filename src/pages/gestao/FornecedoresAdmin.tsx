import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Settings2,
  Wrench,
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_TYPES,
  SUPPLIER_SUBCATEGORIES_BY_TYPE,
  type SupplierType,
} from "@/constants/supplierCategories";

/* ───────── Types ───────── */
interface SupplierSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
}

const TYPE_ICONS: Record<SupplierType, React.ReactNode> = {
  prestadores: <Wrench className="h-4 w-4" />,
  produtos: <Package className="h-4 w-4" />,
};

const TYPE_COLORS: Record<SupplierType, string> = {
  prestadores: "bg-blue-100 text-blue-800",
  produtos: "bg-amber-100 text-amber-800",
};

export default function FornecedoresAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [expandedType, setExpandedType] = useState<SupplierType | null>(
    "prestadores",
  );

  // ── Settings ──
  const { data: settings = [] } = useQuery({
    queryKey: ["supplier-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as SupplierSetting[];
    },
  });

  const updateSettingMut = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("supplier_settings")
        .update({ value: JSON.stringify(value) } as any)
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-settings"] });
      toast({ title: "Configuração atualizada" });
    },
  });

  const getSettingValue = (key: string) => {
    const s = settings.find((s) => s.key === key);
    if (!s) return null;
    try {
      return typeof s.value === "string" ? JSON.parse(s.value) : s.value;
    } catch {
      return s.value;
    }
  };

  const toggleType = (type: SupplierType) => {
    setExpandedType((prev) => (prev === type ? null : type));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/gestao/fornecedores")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Configurações de Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground">
            Taxonomia e preferências do módulo
          </p>
        </div>
      </div>

      {/* Taxonomy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Taxonomia de Fornecedores</CardTitle>
          <CardDescription>
            Categorias principais e subcategorias disponíveis no cadastro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SUPPLIER_TYPES.map((type) => {
            const isExpanded = expandedType === type;
            const subcategories = SUPPLIER_SUBCATEGORIES_BY_TYPE[type];
            return (
              <div key={type} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleType(type)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center h-8 w-8 rounded-md ${TYPE_COLORS[type]}`}
                    >
                      {TYPE_ICONS[type]}
                    </div>
                    <div>
                      <span className="font-medium text-sm">
                        {SUPPLIER_TYPE_LABELS[type]}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {subcategories.length} subcategorias
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      {subcategories.map((sub) => (
                        <Badge
                          key={sub}
                          variant="secondary"
                          className={TYPE_COLORS[type]}
                        >
                          {sub}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2">
            Para adicionar ou remover categorias, edite o arquivo de taxonomia
            do sistema.
          </p>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Preferências</CardTitle>
              <CardDescription>
                Configurações gerais do módulo de fornecedores
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">
                Exigir avaliação ao cadastrar fornecedor
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tornará o campo de nota obrigatório no formulário
              </p>
            </div>
            <Switch
              checked={
                getSettingValue("avaliacao_obrigatoria") === true ||
                getSettingValue("avaliacao_obrigatoria") === "true"
              }
              onCheckedChange={(v) =>
                updateSettingMut.mutate({
                  key: "avaliacao_obrigatoria",
                  value: v,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">
                Prazo de entrega padrão (dias)
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valor sugerido ao cadastrar novo fornecedor
              </p>
            </div>
            <Input
              type="number"
              className="w-24"
              value={getSettingValue("prazo_entrega_padrao") ?? 30}
              onChange={(e) =>
                updateSettingMut.mutate({
                  key: "prazo_entrega_padrao",
                  value: Number(e.target.value),
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
