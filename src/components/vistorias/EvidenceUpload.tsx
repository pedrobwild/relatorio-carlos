import { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2, ImagePlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EvidenceUploadProps {
  projectId: string;
  entityId: string;
  value: string[];
  onChange: (paths: string[]) => void;
  required?: boolean;
  disabled?: boolean;
  maxFiles?: number;
}

export function EvidenceUpload({
  projectId,
  entityId,
  value,
  onChange,
  required = false,
  disabled = false,
  maxFiles = 5,
}: EvidenceUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadSignedUrl = async (path: string) => {
    if (signedUrls[path]) return;
    const { data } = await supabase.storage
      .from('inspection-evidences')
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
    }
  };

  // Load URLs for existing paths
  useState(() => {
    value.forEach(loadSignedUrl);
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${maxFiles} fotos atingido`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);

    try {
      const newPaths: string[] = [];

      for (const file of filesToUpload) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const uuid = crypto.randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const storagePath = `${projectId}/${entityId}/${uuid}_${safeName}`;

        const { error } = await supabase.storage
          .from('inspection-evidences')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
          continue;
        }

        newPaths.push(storagePath);

        // Pre-load signed URL
        const { data: urlData } = await supabase.storage
          .from('inspection-evidences')
          .createSignedUrl(storagePath, 3600);
        if (urlData?.signedUrl) {
          setSignedUrls(prev => ({ ...prev, [storagePath]: urlData.signedUrl }));
        }
      }

      if (newPaths.length > 0) {
        onChange([...value, ...newPaths]);
        toast.success(`${newPaths.length} foto(s) enviada(s)`);
      }
    } catch (err) {
      toast.error('Erro ao enviar fotos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemove = async (path: string) => {
    const { error } = await supabase.storage
      .from('inspection-evidences')
      .remove([path]);

    if (error) {
      toast.error('Erro ao remover foto');
      return;
    }

    onChange(value.filter(p => p !== path));
    setSignedUrls(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const showError = required && value.length === 0;

  return (
    <div className="space-y-2">
      {/* Thumbnails */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((path) => (
            <div key={path} className="relative group w-16 h-16 rounded-md overflow-hidden border bg-muted">
              {signedUrls[path] ? (
                <img
                  src={signedUrls[path]}
                  alt="Evidência"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(path)}
                  className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl-md p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity min-w-[28px] min-h-[28px] flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload buttons */}
      {!disabled && value.length < maxFiles && (
        <div className="flex items-center gap-2">
          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-11 min-w-[44px]"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            Foto
          </Button>

          {/* Camera capture (mobile) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-11 min-w-[44px]"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Câmera</span>
          </Button>

          {uploading && (
            <span className="text-xs text-muted-foreground">Enviando...</span>
          )}
        </div>
      )}

      {/* Required error */}
      {showError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Foto obrigatória para itens reprovados
        </p>
      )}
    </div>
  );
}
