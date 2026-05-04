import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Download,
  FileText,
  Image,
  File,
  Eye,
  X,
} from "lucide-react";

interface Attachment {
  id: string;
  fornecedor_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  tipo: string;
  created_at: string;
}

interface Props {
  fornecedorId: string;
}

function getFileIcon(mime: string | null) {
  if (!mime) return File;
  if (mime.startsWith("image/")) return Image;
  if (mime.includes("pdf")) return FileText;
  return File;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}

function AttachmentPreview({ att }: { att: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("fornecedor-anexos")
      .createSignedUrl(att.file_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [att.file_path]);

  if (!url) {
    return <div className="h-32 w-full rounded-md bg-muted/50 animate-pulse" />;
  }

  if (isImage(att.mime_type)) {
    return (
      <>
        <div
          className="relative cursor-pointer group/img"
          onClick={() => setFullscreen(true)}
        >
          <img
            src={url}
            alt={att.file_name}
            className="w-full h-40 object-cover rounded-md border"
          />
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors rounded-md flex items-center justify-center">
            <Eye className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
          </div>
        </div>

        {fullscreen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setFullscreen(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setFullscreen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={url}
              alt={att.file_name}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  // Non-image: show icon card with link
  const Icon = getFileIcon(att.mime_type);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors"
    >
      <Icon className="h-8 w-8 text-muted-foreground shrink-0" />
      <span className="text-sm text-primary underline underline-offset-2 truncate">
        Abrir {att.file_name}
      </span>
    </a>
  );
}

export function SupplierAttachmentsTab({ fornecedorId }: Props) {
  const qc = useQueryClient();
  const qk = ["fornecedor_anexos", fornecedorId];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedor_anexos")
        .select("*")
        .eq("fornecedor_id", fornecedorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Attachment[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (att: Attachment) => {
      await supabase.storage.from("fornecedor-anexos").remove([att.file_path]);
      const { error } = await supabase
        .from("fornecedor_anexos")
        .delete()
        .eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Anexo removido" });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${fornecedorId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("fornecedor-anexos")
          .upload(path, file);
        if (uploadErr) throw uploadErr;

        const { error: dbErr } = await supabase
          .from("fornecedor_anexos")
          .insert({
            fornecedor_id: fornecedorId,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            mime_type: file.type || null,
            tipo: "outro",
            uploaded_by: user.id,
          });
        if (dbErr) throw dbErr;
      }

      qc.invalidateQueries({ queryKey: qk });
      toast({ title: `${files.length} anexo(s) enviado(s)` });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async (att: Attachment) => {
    const { data, error } = await supabase.storage
      .from("fornecedor-anexos")
      .createSignedUrl(att.file_path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao gerar link", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Anexos</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />{" "}
          {uploading ? "Enviando..." : "Anexar Arquivo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum anexo adicionado
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="rounded-lg border bg-card overflow-hidden"
            >
              <div className="p-2">
                <AttachmentPreview att={att} />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {att.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(att.file_size)} ·{" "}
                    {new Date(att.created_at!).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDownload(att)}
                    title="Baixar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteMut.mutate(att)}
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
