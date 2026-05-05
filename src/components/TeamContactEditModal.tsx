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
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, User } from "lucide-react";
import { TeamContact, TeamContactInput } from "@/hooks/useTeamContacts";

interface TeamContactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: TeamContact | null;
  roleLabel: string;
  onSave: (data: TeamContactInput) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<string>;
  isSaving: boolean;
  isUploading: boolean;
}

export function TeamContactEditModal({
  open,
  onOpenChange,
  contact,
  roleLabel,
  onSave,
  onUploadPhoto,
  isSaving,
  isUploading,
}: TeamContactEditModalProps) {
  const [formData, setFormData] = useState({
    display_name: "",
    phone: "",
    email: "",
    crea: "",
    photo_url: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (contact) {
      setFormData({
        display_name: contact.display_name || "",
        phone: contact.phone || "",
        email: contact.email || "",
        crea: contact.crea || "",
        photo_url: contact.photo_url || "",
      });
      setPreviewUrl(contact.photo_url);
    }
  }, [contact]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const url = await onUploadPhoto(file);
      setFormData((prev) => ({ ...prev, photo_url: url }));
    } catch (_error) {
      // Reset preview on error
      setPreviewUrl(formData.photo_url || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;

    await onSave({
      project_id: contact.project_id,
      role_type: contact.role_type,
      display_name: formData.display_name,
      phone: formData.phone || null,
      email: formData.email || null,
      crea: formData.crea || null,
      photo_url: formData.photo_url || null,
    });
    onOpenChange(false);
  };

  const isLoading = isSaving || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {roleLabel}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-32 w-32 border-2 border-border">
                <AvatarImage
                  src={previewUrl || undefined}
                  alt={formData.display_name}
                />
                <AvatarFallback className="bg-accent text-4xl">
                  <User className="w-12 h-12" />
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50"
                aria-label="Alterar foto"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Foto 500x500px recomendado
          </p>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name">Nome</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  display_name: e.target.value,
                }))
              }
              required
              placeholder="Nome completo"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="email@bwild.com.br"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* CREA (only for engineering) */}
          {contact?.role_type === "engenharia" && (
            <div className="space-y-2">
              <Label htmlFor="crea">CREA</Label>
              <Input
                id="crea"
                value={formData.crea}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, crea: e.target.value }))
                }
                placeholder="0000000000-UF"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
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
