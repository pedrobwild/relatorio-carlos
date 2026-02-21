import { useState, useRef } from 'react';
import { Upload, File, Image, FileText, ExternalLink, Plus, Eye, Download, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DocumentViewer } from '@/components/DocumentViewer';
import { 
  uploadFormalizationAttachment, 
  getAttachmentUrl, 
  downloadAttachment,
  validateFile,
  formatFileSize,
  getFileTypeLabel,
  isImageFile,
} from '@/lib/formalizationStorage';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { EVIDENCE_LINK_KIND_LABELS, type EvidenceLinkKind } from '@/types/formalization';

interface FormalizacaoEvidenceProps {
  formalizationId: string;
  attachments: Array<{
    id: string;
    original_filename: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
  evidenceLinks: Array<{
    id: string;
    kind: string;
    url: string;
    description: string | null;
    created_at: string;
  }>;
  isLocked: boolean;
}

export function FormalizacaoEvidence({ 
  formalizationId, 
  attachments, 
  evidenceLinks,
  isLocked 
}: FormalizacaoEvidenceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({ kind: 'other' as EvidenceLinkKind, url: '', description: '' });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; mimeType: string; storagePath: string } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file);
    
    if (!validation.valid) {
      toast({
        title: 'Arquivo inválido',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      await uploadFormalizationAttachment(formalizationId, file);
      toast({
        title: 'Arquivo enviado',
        description: `${file.name} foi anexado com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['formalizacao', formalizationId] });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o arquivo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    try {
      const downloaded = await downloadAttachment(storagePath, filename);
      if (!downloaded) {
        throw new Error('Falha ao gerar URL de download');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar o arquivo.',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = async (attachmentId: string, storagePath: string, filename: string, mimeType: string) => {
    setPreviewOpen(true);
    setPreviewingId(attachmentId);
    setPreviewUrl(null);
    setPreviewFile({ name: filename, mimeType, storagePath });

    const url = await getAttachmentUrl(storagePath);
    if (!url) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a pré-visualização do anexo.',
        variant: 'destructive',
      });
      setPreviewingId(null);
      setPreviewOpen(false);
      return;
    }

    setPreviewUrl(url);
    setPreviewingId(null);
  };

  const handleAddLink = async () => {
    if (!newLink.url) {
      toast({
        title: 'URL obrigatória',
        description: 'Informe a URL do link.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      const { error } = await supabase.from('formalization_evidence_links').insert({
        formalization_id: formalizationId,
        kind: newLink.kind,
        url: newLink.url,
        description: newLink.description || null,
        created_by: user?.id || '',
      });

      if (error) throw error;

      toast({
        title: 'Link adicionado',
        description: 'O link de evidência foi adicionado.',
      });
      
      setLinkDialogOpen(false);
      setNewLink({ kind: 'other', url: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['formalizacao', formalizationId] });
    } catch (error) {
      console.error('Error adding link:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o link.',
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (isImageFile(mimeType)) return <Image className="h-5 w-5" />;
    if (mimeType === 'application/pdf') return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Attachments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Anexos</CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Adicionar anexo"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Adicionar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum anexo adicionado
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div 
                  key={attachment.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(attachment.mime_type)}
                    <div>
                      <p className="font-medium text-sm">{attachment.original_filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {getFileTypeLabel(attachment.mime_type)} • {formatFileSize(attachment.size_bytes)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(
                        attachment.id,
                        attachment.storage_path,
                        attachment.original_filename,
                        attachment.mime_type
                      )}
                      aria-label={`Pré-visualizar ${attachment.original_filename}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(attachment.storage_path, attachment.original_filename)}
                      aria-label={`Baixar ${attachment.original_filename}`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewUrl(null);
            setPreviewFile(null);
            setPreviewingId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <DialogTitle className="text-base truncate">
              {previewFile?.name ?? 'Pré-visualização do anexo'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewingId ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : previewUrl && previewFile ? (
              <DocumentViewer
                url={previewUrl}
                title={previewFile.name}
                mimeType={previewFile.mimeType}
                className="h-full rounded-none border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-muted-foreground">Não foi possível carregar a pré-visualização.</p>
                {previewFile && (
                  <Button onClick={() => handleDownload(previewFile.storagePath, previewFile.name)} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar arquivo
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Evidence Links */}
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
                  Adicione um link externo como evidência (gravação, documento, etc.)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="link-kind">Tipo</Label>
                  <Select
                    value={newLink.kind}
                    onValueChange={(value) => setNewLink(prev => ({ ...prev, kind: value as EvidenceLinkKind }))}
                  >
                    <SelectTrigger id="link-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVIDENCE_LINK_KIND_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
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
                    onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-description">Descrição (opcional)</Label>
                  <Input
                    id="link-description"
                    placeholder="Descrição do link"
                    value={newLink.description}
                    onChange={(e) => setNewLink(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddLink}>
                  Adicionar
                </Button>
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
                        {link.description || EVIDENCE_LINK_KIND_LABELS[link.kind as EvidenceLinkKind]}
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
    </div>
  );
}
