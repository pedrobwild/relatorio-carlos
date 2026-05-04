import { useState } from "react";
import { FileDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Inspection, InspectionItem } from "@/hooks/useInspections";
import { getInspectionTypeConfig } from "./inspectionConstants";

const typeTitles: Record<string, string> = {
  rotina: "Relatório de Vistoria de Rotina",
  recebimento_etapa: "Relatório de Vistoria de Recebimento de Etapa",
  entrega_cliente: "Relatório de Vistoria de Entrega ao Cliente",
  seguranca: "Relatório de Vistoria de Segurança do Trabalho",
  pos_chuva: "Relatório de Vistoria Pós-Chuva / Emergência",
  garantia: "Relatório de Vistoria de Garantia",
};

interface Props {
  inspection: Inspection;
  items: InspectionItem[];
}

export function InspectionPdfExport({ inspection, items }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const inspectionType = (inspection as any).inspection_type || "rotina";
      const typeConfig = getInspectionTypeConfig(inspectionType);
      const title = typeTitles[inspectionType] || "Relatório de Vistoria";
      const inspectorName = (inspection as any).inspector_user_name || "";
      const clientPresent = (inspection as any).client_present || false;
      const clientName = (inspection as any).client_name || "";

      const approvedCount = items.filter((i) => i.result === "approved").length;
      const rejectedCount = items.filter((i) => i.result === "rejected").length;
      const naCount = items.filter((i) => i.result === "not_applicable").length;
      const pendingCount = items.filter((i) => i.result === "pending").length;

      const resultLabel: Record<string, string> = {
        approved: "✅ OK",
        rejected: "❌ NC",
        not_applicable: "➖ N/A",
        pending: "⏳ Pendente",
      };

      const date = format(parseISO(inspection.inspection_date), "dd/MM/yyyy", {
        locale: ptBR,
      });
      const statusLabel =
        inspection.status === "completed" ? "Concluída" : "Em andamento";

      const signatureBlock =
        inspectionType === "entrega_cliente"
          ? `
        <div style="margin-top: 40px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; gap: 32px; margin-top: 32px;">
            <div style="flex: 1; text-align: center; border-top: 1px solid #999; padding-top: 8px; font-size: 11px;">
              Vistoriado por: ${inspectorName || "________________________"}
            </div>
            <div style="flex: 1; text-align: center; border-top: 1px solid #999; padding-top: 8px; font-size: 11px;">
              Acompanhado por: ${clientName || "________________________"}
            </div>
            <div style="flex: 1; text-align: center; border-top: 1px solid #999; padding-top: 8px; font-size: 11px;">
              Data: ${date}
            </div>
          </div>
        </div>
      `
          : "";

      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1a1a1a; max-width: 800px;">
          <h1 style="font-size: 20px; margin-bottom: 4px;">${title}</h1>
          <p style="color: #666; font-size: 13px; margin-bottom: 4px;">Tipo: ${typeConfig.emoji} ${typeConfig.label}</p>
          <p style="color: #666; font-size: 13px; margin-bottom: 20px;">Data: ${date} | Status: ${statusLabel}${inspectorName ? ` | Vistoriador: ${inspectorName}` : ""}${clientPresent ? ` | Cliente: ${clientName || "Presente"}` : ""}</p>
          
          ${inspection.activity_description ? `<p style="font-size: 13px; margin-bottom: 8px;"><strong>Atividade:</strong> ${inspection.activity_description}</p>` : ""}
          ${inspection.notes ? `<p style="font-size: 13px; margin-bottom: 8px; color: #555;"><strong>Observações:</strong> ${inspection.notes}</p>` : ""}
          
          <div style="display: flex; gap: 16px; margin: 16px 0; font-size: 13px;">
            <span>✅ ${approvedCount}</span>
            <span>❌ ${rejectedCount}</span>
            <span>➖ ${naCount}</span>
            ${pendingCount > 0 ? `<span>⏳ ${pendingCount}</span>` : ""}
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; width: 40px;">#</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Item</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; width: 80px;">Resultado</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Observações</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item, i) => `
                <tr style="${item.result === "rejected" ? "background: #fef2f2;" : ""}">
                  <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${i + 1}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px;">${item.description}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${resultLabel[item.result]}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; color: #666;">${item.notes || "—"}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          ${signatureBlock}

          <p style="font-size: 10px; color: #999; margin-top: 24px; text-align: center;">
            Gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      `;

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.appendChild(container);

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `vistoria-${date.replace(/\//g, "-")}.pdf`,
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container)
        .save();

      document.body.removeChild(container);
      toast.success("PDF exportado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 h-9"
      onClick={handleExport}
      disabled={exporting}
    >
      <FileDown className="h-3.5 w-3.5" />
      {exporting ? "Gerando..." : "Exportar PDF"}
    </Button>
  );
}
