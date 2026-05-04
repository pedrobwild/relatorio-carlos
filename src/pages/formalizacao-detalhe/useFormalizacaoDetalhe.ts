import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useFormalizacao,
  useAcknowledge,
  useSendForSignature,
  useDeleteFormalizacao,
  useUpdateFormalizacao,
} from "@/hooks/useFormalizacoes";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { patchPortalViewState } from "@/lib/portalViewState";
import { invokeFunction } from "@/infra/edgeFunctions";
import { isSeedData, type PartyRow, type AckRow } from "./types";

export function useFormalizacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { paths, projectId } = useProjectNavigation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isStaff } = useUserRole();

  const [activeTab, setActiveTab] = useState("conteudo");
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingForSignature, setSendingForSignature] = useState(false);
  const [editingContent, setEditingContent] = useState(false);

  const { data: formalizacao, isLoading, refetch } = useFormalizacao(id);
  const acknowledge = useAcknowledge();
  const sendForSignature = useSendForSignature();
  const deleteFormalizacao = useDeleteFormalizacao();
  const updateFormalizacao = useUpdateFormalizacao();

  const isDemo = isSeedData(formalizacao);

  const parties = (formalizacao?.parties as unknown as PartyRow[] | null) || [];
  const acknowledgements =
    (formalizacao?.acknowledgements as unknown as AckRow[] | null) || [];
  const events = (formalizacao?.events as unknown as any[] | null) || [];

  const isDraft = formalizacao?.status === "draft";
  const hasCustomer = parties.some((p) => p.party_type === "customer");
  const hasCompany = parties.some((p) => p.party_type === "company");
  const hasParties = hasCustomer && hasCompany;

  const pendingParties = parties.filter(
    (p) => p.must_sign && !acknowledgements.some((a) => a.party_id === p.id),
  );

  const pendingPartyByBinding = pendingParties.find((p) => {
    if (!user) return false;
    const userIdMatch = p.user_id && p.user_id === user.id;
    const emailMatch =
      p.email &&
      user.email &&
      p.email.toLowerCase() === user.email.toLowerCase();
    return userIdMatch || emailMatch;
  });

  const pendingCompanyPartyForStaff = isStaff
    ? pendingParties.find((p) => p.party_type === "company")
    : null;

  const pendingPartyForUser =
    pendingPartyByBinding || pendingCompanyPartyForStaff;

  const goBackToList = useCallback(() => {
    if (projectId) {
      patchPortalViewState(`portal_${projectId}`, {
        activeTab: "formalizacoes",
      });
      navigate(`/obra/${projectId}`);
    } else {
      navigate(paths?.formalizacoes || "/formalizacoes");
    }
  }, [projectId, navigate, paths]);

  const handleSendForSignature = async () => {
    if (!id || !isDraft) return;
    if (isDemo) {
      toast({
        title: "Dados de demonstração",
        description:
          "Esta funcionalidade não está disponível para dados de exemplo.",
      });
      return;
    }
    setSendingForSignature(true);
    try {
      await sendForSignature.mutateAsync(id);
      toast({
        title: "Enviado para assinatura",
        description:
          "A formalização foi travada e enviada para coleta de assinaturas.",
      });
      refetch();
    } catch (error) {
      console.error("Error sending for signature:", error);
      toast({
        title: "Erro",
        description:
          "Não foi possível enviar para assinatura. Verifique se há partes cadastradas.",
        variant: "destructive",
      });
    } finally {
      setSendingForSignature(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!pendingPartyForUser || !id) return;
    if (!user) {
      toast({
        title: "Faça login",
        description: "Entre no portal para registrar sua assinatura.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    if (formalizacao?.status !== "pending_signatures") {
      toast({
        title: "Assinatura indisponível",
        description:
          "Se estiver em rascunho, envie para assinatura antes de registrar ciência.",
        variant: "destructive",
      });
      return;
    }
    if (isDemo) {
      toast({
        title: "Dados de demonstração",
        description: "A assinatura não está disponível para dados de exemplo.",
      });
      return;
    }
    try {
      await acknowledge.mutateAsync({
        formalizationId: id,
        partyId: pendingPartyForUser.id,
        signatureText: "Li e estou ciente do conteúdo desta formalização.",
      });
      toast({
        title: "Ciência registrada",
        description: "Sua ciência foi registrada com sucesso.",
      });
    } catch (error) {
      console.error("Error acknowledging:", error);
      const errorMessage = (error as Error)?.message ?? "";
      const isRls =
        typeof errorMessage === "string" &&
        errorMessage.includes("row-level security");
      toast({
        title: "Erro",
        description: isRls
          ? "Você só pode assinar como a parte vinculada ao seu usuário/e-mail."
          : "Não foi possível registrar sua ciência. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (!id) return;
    if (isDemo) {
      toast({
        title: "Dados de demonstração",
        description:
          "O download de PDF não está disponível para dados de exemplo.",
      });
      return;
    }
    setDownloadingPdf(true);
    try {
      const { data, error } = await invokeFunction("formalization-pdf", {
        formalization_id: id,
      });
      if (error) throw error;
      const blob = new Blob([data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `formalizacao-${id.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "PDF gerado",
        description: "O download do PDF foi iniciado.",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteFormalizacao.mutateAsync(id);
      toast({
        title: "Formalização excluída",
        description: "O documento foi removido permanentemente.",
      });
      goBackToList();
    } catch (error) {
      console.error("Error deleting formalization:", error);
      toast({
        title: "Erro ao excluir",
        description:
          "Não foi possível excluir a formalização. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateContent = async (html: string) => {
    if (!id) return;
    try {
      await updateFormalizacao.mutateAsync({ id, data: { body_md: html } });
      toast({
        title: "Conteúdo atualizado",
        description: "O conteúdo da formalização foi salvo com sucesso.",
      });
      refetch();
    } catch (error) {
      console.error("Error updating content:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o conteúdo.",
        variant: "destructive",
      });
    }
  };

  return {
    id,
    formalizacao,
    isLoading,
    isAdmin,
    isDemo,
    isDraft,
    hasParties,
    parties,
    acknowledgements,
    events,
    activeTab,
    setActiveTab,
    acknowledged,
    setAcknowledged,
    downloadingPdf,
    sendingForSignature,
    editingContent,
    setEditingContent,
    pendingPartyForUser,
    goBackToList,
    handleSendForSignature,
    handleAcknowledge,
    handleDownloadPdf,
    handleDelete,
    handleUpdateContent,
    deleteFormalizacao,
    acknowledge,
  };
}
