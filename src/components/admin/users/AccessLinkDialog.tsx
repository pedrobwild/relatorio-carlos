import { useState } from "react";
import { Check, Copy, Link2, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { accessInvitesRepo, type AccessLinkTarget } from "@/infra/repositories";

/**
 * Gera o link de primeiro acesso (uso único, 7 dias) para a equipe mandar
 * ao cliente por WhatsApp/e-mail. O cliente cria a própria senha.
 */
export function AccessLinkDialog({
  user,
  trigger,
}: {
  user: AccessLinkTarget;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setCopied(false);
    try {
      const result = await accessInvitesRepo.createAccessInvite(user.id);
      if (result.error || !result.data) {
        toast({
          title: "Não foi possível gerar o link",
          description: accessInvitesRepo.describeAccessInviteError(
            result.error,
          ),
          variant: "destructive",
        });
        return;
      }
      setUrl(
        accessInvitesRepo.buildFirstAccessUrl(
          result.data,
          window.location.origin,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const message = url
    ? accessInvitesRepo.buildAccessLinkMessage(user, url)
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast({
        title: "Mensagem copiada",
        description: "Cole no WhatsApp ou e-mail.",
      });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione o link e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setUrl(null);
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 min-h-[44px] min-w-[44px]"
            title="Link de primeiro acesso"
            aria-label="Link de primeiro acesso"
          >
            <Link2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link de primeiro acesso</DialogTitle>
          <DialogDescription>
            Envie para {user.display_name || user.email}. Pelo link, a pessoa
            cria a própria senha e já entra no portal. Vale por 7 dias e
            funciona uma vez; gerar um novo link cancela o anterior.
          </DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="access-link">Link</Label>
              <Input
                id="access-link"
                value={url}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <div className="space-y-1">
              <Label>Mensagem pronta</Label>
              <p className="whitespace-pre-line rounded-md border border-border bg-muted p-3 text-sm text-foreground">
                {message}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Login do cliente: <strong>{user.email}</strong>
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {url ? (
            <>
              <Button variant="outline" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
              <Button onClick={copy}>
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copiado" : "Copiar mensagem"}
              </Button>
            </>
          ) : (
            <Button onClick={generate} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Gerar link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
