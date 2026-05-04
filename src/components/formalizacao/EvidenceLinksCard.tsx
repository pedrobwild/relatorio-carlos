import { useState } from "react";
import { Plus, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formalizationsRepo } from "@/infra/repositories";
import {
  EVIDENCE_LINK_KIND_LABELS,
  type EvidenceLinkKind,
} from "@/types/formalization";
import { queryKeys } from "@/lib/queryKeys";

interface EvidenceLink {
  id: string;
  kind: string;
  url: string;
  description: string | null;
  created_at: string;
}

interface EvidenceLinksCardProps {
  formalizationId: string;
  evidenceLinks: EvidenceLink[];
}

export function EvidenceLinksCard({
  formalizationId,
  evidenceLinks,
}: EvidenceLinksCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({
    kind: "other" as EvidenceLinkKind,
    url: "",
    description: "",
  });

  const handleAddLink = async () => {
    if (!newLink.url) {
      toast({
        title: "URL obrigatória",
        description: "Informe a URL do link.",
        variant: "destructive",
      });
      return;
    }
    try {
      const {
        data: { session },
      } = await (
        await import("@/integrations/supabase/client")
      ).supabase.auth.getSession();
      const userId = session?.user?.id || "";
      const { error } = await formalizationsRepo.addEvidenceLink({
        formalization_id: formalizationId,
        kind: newLink.kind,
        url: newLink.url,
        description: newLink.description || null,
        created_by: userId,
      });
      if (error) throw error;
      toast({
        title: "Link adicionado",
        description: "O link de evidência foi adicionado.",
      });
      setLinkDialogOpen(false);
      setNewLink({ kind: "other", url: "", description: "" });
      queryClient.invalidateQueries({
        queryKey: queryKeys.formalizacoes.detail(formalizationId),
      });
    } catch (error) {
      console.error("Error adding link:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o link.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Links de Evidência</CardTitle>
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Adicionar link">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Link de Evidência</DialogTitle>
              <DialogDescription>
                Adicione um link externo como evidência (gravação, documento,
                etc.)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="link-kind">Tipo</Label>
                <Select
                  value={newLink.kind}
                  onValueChange={(value) =>
                    setNewLink((prev) => ({
                      ...prev,
                      kind: value as EvidenceLinkKind,
                    }))
                  }
                >
                  <SelectTrigger id="link-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVIDENCE_LINK_KIND_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  type="url"
                  placeholder="https://..."
                  value={newLink.url}
                  onChange={(e) =>
                    setNewLink((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-description">Descrição (opcional)</Label>
                <Input
                  id="link-description"
                  placeholder="Descrição do link"
                  value={newLink.description}
                  onChange={(e) =>
                    setNewLink((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setLinkDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddLink}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {evidenceLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum link adicionado
          </p>
        ) : (
          <div className="space-y-2">
            {evidenceLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">
                      {link.description ||
                        EVIDENCE_LINK_KIND_LABELS[
                          link.kind as EvidenceLinkKind
                        ]}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {EVIDENCE_LINK_KIND_LABELS[link.kind as EvidenceLinkKind]}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  aria-label="Abrir link"
                >
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
