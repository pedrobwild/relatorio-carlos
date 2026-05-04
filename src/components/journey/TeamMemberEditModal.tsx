import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineRichEditor } from "@/components/ui/inline-rich-editor";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, User } from "lucide-react";
import type { JourneyTeamMember } from "@/hooks/useJourneyTeamMembers";

interface TeamMemberEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: JourneyTeamMember | null; // null = creating new
  onSave: (data: {
    display_name: string;
    role_title: string;
    description: string;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
  }) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<string>;
  isSaving: boolean;
  isUploading: boolean;
}

export function TeamMemberEditModal({
  open,
  onOpenChange,
  member,
  onSave,
  onUploadPhoto,
  isSaving,
  isUploading,
}: TeamMemberEditModalProps) {
  const [form, setForm] = useState({
    display_name: "",
    role_title: "",
    description: "",
    email: "",
    phone: "",
    photo_url: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (member) {
      setForm({
        display_name: member.display_name,
        role_title: member.role_title,
        description: member.description,
        email: member.email || "",
        phone: member.phone || "",
        photo_url: member.photo_url || "",
      });
      setPreviewUrl(member.photo_url);
    } else {
      setForm({
        display_name: "",
        role_title: "",
        description: "",
        email: "",
        phone: "",
        photo_url: "",
      });
      setPreviewUrl(null);
    }
  }, [member, open]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
    try {
      const url = await onUploadPhoto(file);
      setForm((prev) => ({ ...prev, photo_url: url }));
    } catch {
      setPreviewUrl(form.photo_url || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      display_name: form.display_name.trim(),
      role_title: form.role_title.trim(),
      description: form.description.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      photo_url: form.photo_url || null,
    });
    onOpenChange(false);
  };

  const isLoading = isSaving || isUploading;
  const isNew = !member;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Adicionar membro do time" : "Editar membro do time"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage
                  src={previewUrl || undefined}
                  alt={form.display_name}
                />
                <AvatarFallback className="bg-accent text-2xl">
                  <User className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50"
                aria-label="Alterar foto"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tm_name">Nome *</Label>
            <Input
              id="tm_name"
              value={form.display_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, display_name: e.target.value }))
              }
              required
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tm_role">Cargo *</Label>
            <Input
              id="tm_role"
              value={form.role_title}
              onChange={(e) =>
                setForm((p) => ({ ...p, role_title: e.target.value }))
              }
              required
              placeholder="Ex: Gerente de Sucesso do Cliente"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição da função *</Label>
            <InlineRichEditor
              value={form.description}
              onChange={(html) => setForm((p) => ({ ...p, description: html }))}
              placeholder="Descreva a função desta pessoa no projeto..."
              minHeight="100px"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tm_email">E-mail</Label>
              <Input
                id="tm_email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="email@bwild.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm_phone">Telefone</Label>
              <Input
                id="tm_phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !form.display_name.trim() ||
                !form.role_title.trim()
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isNew ? (
                "Adicionar"
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
