import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Link, Quote, Code, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectInfoDocProps {
  projectId: string;
}

function ToolbarButton({
  onClick,
  children,
  title,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

export function ProjectInfoDoc({ projectId }: ProjectInfoDocProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contentHtml, setContentHtml] = useState('');
  const [docExists, setDocExists] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchDoc();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [projectId]);

  const fetchDoc = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('project_info_docs' as any)
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle());
      if (error) throw error;
      if (data) {
        setContentHtml((data as any).content_html || '');
        setDocExists(true);
      } else {
        setContentHtml('');
        setDocExists(false);
      }
    } catch (err) {
      console.error('Error fetching project info doc:', err);
      toast.error('Erro ao carregar documento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!editorRef.current || loading) return;
    if (!initializedRef.current) {
      editorRef.current.innerHTML = contentHtml || '';
      initializedRef.current = true;
    }
  }, [contentHtml, loading]);

  const saveDoc = useCallback(
    async (html: string) => {
      setSaving(true);
      setSaved(false);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (docExists) {
          const { error } = await (supabase
            .from('project_info_docs' as any)
            .update({
              content_html: html,
              last_edited_by: user?.id,
            } as any)
            .eq('project_id', projectId));
          if (error) throw error;
        } else {
          const { error } = await (supabase
            .from('project_info_docs' as any)
            .insert({
              project_id: projectId,
              content_html: html,
              last_edited_by: user?.id,
            } as any));
          if (error) throw error;
          setDocExists(true);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('Error saving project info doc:', err);
        toast.error('Erro ao salvar documento');
      } finally {
        setSaving(false);
      }
    },
    [projectId, docExists]
  );

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    setContentHtml(html);

    // Auto-save after 2s of inactivity
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDoc(html);
    }, 2000);
  }, [saveDoc]);

  const exec = useCallback(
    (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleInput();
    },
    [handleInput]
  );

  const execBlock = useCallback(
    (tag: string) => {
      document.execCommand('formatBlock', false, tag);
      editorRef.current?.focus();
      handleInput();
    },
    [handleInput]
  );

  const insertLink = useCallback(() => {
    const url = prompt('URL do link:');
    if (url) {
      exec('createLink', url);
    }
  }, [exec]);

  const handleManualSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveDoc(editorRef.current?.innerHTML || '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0 space-y-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-background border border-border rounded-t-lg">
          <div className="flex items-center gap-0.5 px-3 py-2 flex-wrap">
            <ToolbarButton onClick={() => exec('undo')} title="Desfazer">
              <Undo className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('redo')} title="Refazer">
              <Redo className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onClick={() => execBlock('h1')} title="Título grande">
              <Heading1 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => execBlock('h2')} title="Título médio">
              <Heading2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => execBlock('h3')} title="Título pequeno">
              <Heading3 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => execBlock('p')} title="Texto normal">
              <span className="text-xs font-medium">T</span>
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onClick={() => exec('bold')} title="Negrito">
              <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('italic')} title="Itálico">
              <Italic className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('underline')} title="Sublinhado">
              <Underline className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('strikeThrough')} title="Riscado">
              <Strikethrough className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Lista com marcadores">
              <List className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('insertOrderedList')} title="Lista numerada">
              <ListOrdered className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onClick={() => exec('justifyLeft')} title="Alinhar à esquerda">
              <AlignLeft className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('justifyCenter')} title="Centralizar">
              <AlignCenter className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('justifyRight')} title="Alinhar à direita">
              <AlignRight className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton onClick={insertLink} title="Inserir link">
              <Link className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => execBlock('blockquote')} title="Citação">
              <Quote className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => execBlock('pre')} title="Código">
              <Code className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => exec('insertHorizontalRule')} title="Linha divisória">
              <Minus className="w-4 h-4" />
            </ToolbarButton>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Salvo
                </span>
              )}
              {saving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Salvando...
                </span>
              )}
              <Button size="sm" variant="outline" onClick={handleManualSave} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Salvar
              </Button>
            </div>
          </div>
        </div>

        {/* Editor area */}
        <div className="border border-t-0 border-border rounded-b-lg bg-background min-h-[500px]">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            data-placeholder="Comece a escrever as informações do projeto aqui..."
            className={cn(
              'px-8 py-6 outline-none min-h-[500px]',
              'prose prose-sm sm:prose max-w-none',
              'text-foreground leading-relaxed',
              '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-foreground',
              '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-foreground',
              '[&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-foreground',
              '[&_p]:mb-2 [&_p]:text-foreground',
              '[&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mb-1',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
              '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:text-sm [&_pre]:font-mono',
              '[&_a]:text-primary [&_a]:underline',
              '[&_hr]:my-4 [&_hr]:border-border',
              'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none',
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
