import { Home, Ruler, Key, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export interface StudioInfo {
  project_id: string;
  nome_do_empreendimento: string | null;
  endereco_completo: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  complemento: string | null;
  tamanho_imovel_m2: number | null;
  tipo_de_locacao: string | null;
  data_recebimento_chaves: string | null;
}

interface TabFichaTecnicaProps {
  studioInfo: StudioInfo;
  onChange: (field: keyof StudioInfo, value: string | number | null) => void;
}

export function TabFichaTecnica({
  studioInfo,
  onChange,
}: TabFichaTecnicaProps) {
  return (
    <div className="space-y-6">
      {/* Identification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Home className="h-5 w-5" />
            Identificação do Imóvel
          </CardTitle>
          <CardDescription>
            Dados do empreendimento e localização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nome do Empreendimento</Label>
              <Input
                value={studioInfo.nome_do_empreendimento || ""}
                onChange={(e) =>
                  onChange("nome_do_empreendimento", e.target.value || null)
                }
                placeholder="Ex: Residencial Jardins"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <MapPin className="h-5 w-5" />
            Endereço do Imóvel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Endereço Completo</Label>
              <Input
                value={studioInfo.endereco_completo || ""}
                onChange={(e) =>
                  onChange("endereco_completo", e.target.value || null)
                }
                placeholder="Rua, número"
              />
            </div>
            <div>
              <Label>Complemento</Label>
              <Input
                value={studioInfo.complemento || ""}
                onChange={(e) =>
                  onChange("complemento", e.target.value || null)
                }
                placeholder="Apto, Bloco"
              />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input
                value={studioInfo.bairro || ""}
                onChange={(e) => onChange("bairro", e.target.value || null)}
              />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input
                value={studioInfo.cidade || ""}
                onChange={(e) => onChange("cidade", e.target.value || null)}
              />
            </div>
            <div>
              <Label>CEP</Label>
              <Input
                value={studioInfo.cep || ""}
                onChange={(e) => onChange("cep", e.target.value || null)}
                placeholder="00000-000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical specs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Ruler className="h-5 w-5" />
            Dados Técnicos
          </CardTitle>
          <CardDescription>
            Metragem, tipo de locação e informações técnicas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Tamanho do Imóvel (m²)</Label>
              <Input
                type="number"
                step="0.01"
                value={studioInfo.tamanho_imovel_m2 ?? ""}
                onChange={(e) =>
                  onChange(
                    "tamanho_imovel_m2",
                    e.target.value ? parseFloat(e.target.value) : null,
                  )
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Tipo de Locação</Label>
              <Input
                value={studioInfo.tipo_de_locacao || ""}
                onChange={(e) =>
                  onChange("tipo_de_locacao", e.target.value || null)
                }
                placeholder="Ex: Residencial, Comercial"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <Key className="h-5 w-5" />
            Recebimento de Chaves
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Data de Recebimento das Chaves</Label>
            <Input
              type="date"
              value={studioInfo.data_recebimento_chaves || ""}
              onChange={(e) =>
                onChange("data_recebimento_chaves", e.target.value || null)
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
