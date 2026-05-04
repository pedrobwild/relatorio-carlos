import { useState } from "react";
import { Edit2, Check, X, Mail, Phone, Upload, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { journeyRepo } from "@/infra/repositories";
import { toast } from "sonner";
import defaultCsmPhoto from "@/assets/csm-victorya.png";

export interface JourneyCSM {
  id: string;
  project_id: string;
  name: string;
  role_title: string;
  description: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
}

interface JourneyCSMSectionProps {
  csm: JourneyCSM;
  projectId: string;
  isAdmin: boolean;
  onUpdate: () => void;
}

export function JourneyCSMSection({
  csm,
  projectId,
  isAdmin,
  onUpdate,
}: JourneyCSMSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: csm.name,
    role_title: csm.role_title,
    description: csm.description,
    email: csm.email || "",
    phone: csm.phone || "",
  });

  const handleSave = async () => {
    try {
      const { error } = await journeyRepo.updateCSM(csm.id, {
        name: formData.name,
        role_title: formData.role_title,
        description: formData.description,
        email: formData.email || null,
        phone: formData.phone || null,
      });

      if (error) throw error;
      toast.success("Informações atualizadas");
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating CSM:", error);
      toast.error("Erro ao atualizar");
    }
  };

  const handleCancel = () => {
    setFormData({
      name: csm.name,
      role_title: csm.role_title,
      description: csm.description,
      email: csm.email || "",
      phone: csm.phone || "",
    });
    setIsEditing(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const photoUrl = await journeyRepo.uploadCSMPhoto(projectId, file);
      if (!photoUrl) throw new Error("Upload failed");

      const { error: updateError } = await journeyRepo.updateCSMPhoto(
        csm.id,
        photoUrl,
      );
      if (updateError) throw updateError;

      toast.success("Foto atualizada");
      onUpdate();
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setIsUploading(false);
    }
  };

  const photoUrl = csm.photo_url || defaultCsmPhoto;

  if (isEditing) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Editando informações
            </span>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                className="h-11 w-11 min-h-[44px]"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={handleSave}
                className="h-11 w-11 min-h-[44px]"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cargo</label>
                <Input
                  value={formData.role_title}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role_title: e.target.value,
                    }))
                  }
                  placeholder="Cargo"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={6}
              placeholder="Descrição sobre o gerente de sucesso..."
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative border-primary/20 bg-gradient-to-br from-background to-muted/30 overflow-hidden">
      {isAdmin && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3 md:top-4 md:right-4 h-11 w-11 min-h-[44px] z-10"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      )}
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-center sm:items-start">
          {/* Photo */}
          <div className="relative shrink-0">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-primary/20">
              <AvatarImage
                src={photoUrl}
                alt={csm.name}
                className="object-cover"
              />
              <AvatarFallback className="text-xl md:text-2xl bg-primary/10">
                <ImageIcon className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            {isAdmin && (
              <label className="absolute bottom-0 right-0 cursor-pointer">
                <div className="h-9 w-9 md:h-8 md:w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors active:scale-95">
                  {isUploading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-3 md:space-y-4 text-center sm:text-left">
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <span className="text-xl md:text-2xl">👋</span>
                <h3 className="text-lg md:text-xl font-semibold">{csm.name}</h3>
              </div>
              <p className="text-sm text-primary font-medium">
                {csm.role_title}
              </p>
            </div>

            <p className="text-muted-foreground whitespace-pre-line leading-relaxed text-sm">
              {csm.description}
            </p>

            <div className="pt-2 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Sempre que precisar, você pode contar com ela.
              </p>

              <div className="flex flex-col gap-3 pt-1">
                {csm.email && (
                  <a
                    href={`mailto:${csm.email}`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors justify-center sm:justify-start min-h-[44px] py-2"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="break-all">{csm.email}</span>
                  </a>
                )}
                {csm.phone && (
                  <a
                    href={`tel:${csm.phone.replace(/\D/g, "")}`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors justify-center sm:justify-start min-h-[44px] py-2"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    {csm.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
