/**
 * Caixa de saída do Diário de obra ligada ao app: IndexedDB + repositório +
 * estado de rede do TanStack. Um único processador para o app inteiro, que
 * roda mesmo fora da tela do diário (a pessoa sai da obra, o sinal volta no
 * elevador, o relato sobe).
 */
import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { diarioObraRepo } from "@/infra/repositories/diarioObra.repository";
import { checkSessionForWrite } from "@/lib/authRecovery";
import { mapError } from "@/lib/errorMapping";
import { invalidateActivityQueries, invalidateInternalScheduleQueries, queryKeys } from "@/lib/queryKeys";
import { uploadReportPhotoBlob } from "@/lib/reportPhotoUpload";
import { createDiarioOutbox, createDiarioStorage, type DiarioOutbox } from "./diarioOutbox";
import { isRetryableSyncError } from "./opsOutcomeSync";

let outbox: DiarioOutbox | null = null;
let client: QueryClient | null = null;

export function getDiarioOutbox(): DiarioOutbox {
  if (outbox) return outbox;
  outbox = createDiarioOutbox({
    storage: createDiarioStorage(),
    isOnline: () => onlineManager.isOnline(),
    currentUser: async () => {
      const { outcome, userId } = await checkSessionForWrite();
      return outcome === "recovered" ? userId : null;
    },
    uploadFoto: async (item, foto) => {
      if (foto.kind === "etapa") {
        // Vai para o cliente: mesmo bucket e mesma pasta das fotos do
        // relatório semanal. Caminho derivado do id: repetir não duplica.
        const res = await uploadReportPhotoBlob({
          projectId: item.projectId,
          weekNumber: item.weekNumber,
          photoId: `diario-${foto.id}`,
          blob: foto.blob,
          mimeType: foto.type,
        });
        return res.path;
      }
      const file = new File([foto.blob], `${foto.id}.jpg`, { type: foto.type || "image/jpeg" });
      const res = await diarioObraRepo.uploadFotoDivergencia(item.projectId, file, `diario-${foto.id}`);
      if (res.error) throw res.error;
      return res.data as string;
    },
    enviar: async (payload) => {
      const res = await diarioObraRepo.enviar(payload);
      if (res.error) throw res.error;
    },
    isConnectionError: isRetryableSyncError,
    describeError: (err) => mapError(err).userMessage,
    onSent: (item) => {
      if (!client) return;
      // O envio lança datas reais e alimenta o relatório semanal.
      invalidateInternalScheduleQueries(client);
      invalidateActivityQueries(item.projectId);
      void client.invalidateQueries({ queryKey: queryKeys.diarioObra.all });
      void client.invalidateQueries({ queryKey: queryKeys.weeklyReports.all });
    },
    onFailed: (item, err) => {
      toast.error(`O relato de ${item.projectName} não foi aceito`, { description: mapError(err).userMessage });
    },
  });
  return outbox;
}

let started = false;

/** Liga o processador: lê o que ficou guardado e envia quando houver rede. */
export function startDiarioSync(qc: QueryClient) {
  client = qc;
  if (started || typeof window === "undefined") return;
  started = true;
  const o = getDiarioOutbox();
  void o
    .load()
    .then(() => o.process())
    .catch((err) => console.warn("[DiarioOffline] Falha ao ler a fila:", err));
  onlineManager.subscribe((online) => {
    if (online) void o.process();
  });
}
