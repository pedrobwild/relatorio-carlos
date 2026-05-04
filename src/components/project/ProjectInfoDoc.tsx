import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocToolbar } from "./doc-editor/DocToolbar";
import {
  SlashCommandMenu,
  useSlashCommands,
} from "./doc-editor/SlashCommandMenu";

interface ProjectInfoDocProps {
  projectId: string;
}

export function ProjectInfoDoc({ projectId }: ProjectInfoDocProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contentHtml, setContentHtml] = useState("");
  const [docExists, setDocExists] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isSavingRef = useRef(false);
  const docExistsRef = useRef(false);

  // Keep docExistsRef in sync
  useEffect(() => {
    docExistsRef.current = docExists;
  }, [docExists]);

  useEffect(() => {
    fetchDoc();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [projectId]);

  const fetchDoc = async () => {
    setLoading(true);
    initializedRef.current = false;
    try {
      const { data, error } = await supabase
        .from("project_info_docs" as any)
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setContentHtml((data as any).content_html || "");
        setDocExists(true);
        docExistsRef.current = true;
      } else {
        setContentHtml("");
        setDocExists(false);
        docExistsRef.current = false;
      }
    } catch (err) {
      console.error("Error fetching project info doc:", err);
      toast.error("Erro ao carregar documento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!editorRef.current || loading) return;
    if (!initializedRef.current) {
      editorRef.current.innerHTML = contentHtml || "";
      initializedRef.current = true;
    }
  }, [contentHtml, loading]);

  const saveDoc = useCallback(
    async (html: string) => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setSaving(true);
      setSaved(false);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (docExistsRef.current) {
          const { error } = await supabase
            .from("project_info_docs" as any)
            .update({ content_html: html, last_edited_by: user?.id } as any)
            .eq("project_id", projectId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("project_info_docs" as any)
            .insert({
              project_id: projectId,
              content_html: html,
              last_edited_by: user?.id,
            } as any);
          if (error) throw error;
          setDocExists(true);
          docExistsRef.current = true;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error("Error saving project info doc:", err);
        toast.error("Erro ao salvar documento");
      } finally {
        setSaving(false);
        isSavingRef.current = false;
      }
    },
    [projectId],
  );

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || "";
    setContentHtml(html);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDoc(html);
    }, 2000);
  }, [saveDoc]);

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      handleInput();
    },
    [handleInput],
  );

  const execBlock = useCallback(
    (tag: string) => {
      editorRef.current?.focus();
      const formattedTag = tag.startsWith("<") ? tag : `<${tag}>`;
      document.execCommand("formatBlock", false, formattedTag);
      handleInput();
    },
    [handleInput],
  );

  const insertLink = useCallback(() => {
    const url = prompt("URL do link:");
    if (url) exec("createLink", url);
  }, [exec]);

  const handleManualSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveDoc(editorRef.current?.innerHTML || "");
  };

  const { menuOpen, menuPosition, commands, handleKeyDown, closeMenu } =
    useSlashCommands(editorRef, exec, execBlock, handleInput);

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
        <DocToolbar
          exec={exec}
          execBlock={execBlock}
          onInsertLink={insertLink}
          saving={saving}
          saved={saved}
          onManualSave={handleManualSave}
        />

        {/* Editor area */}
        <div className="border border-t-0 border-border rounded-b-lg bg-white min-h-[500px] relative">
          {/* Hint text */}
          <div className="px-8 pt-4 pb-0">
            <p className="text-xs text-muted-foreground">
              Digite{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                /
              </kbd>{" "}
              para inserir um bloco ou simplesmente comece a escrever
            </p>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder="Comece a escrever as informações do projeto aqui..."
            className={cn(
              "px-8 py-4 outline-none min-h-[460px]",
              "prose prose-sm sm:prose max-w-none",
              "text-black leading-relaxed",
              "[&_*]:text-black",
              "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-6",
              "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5",
              "[&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-4",
              "[&_p]:mb-2",
              "[&_ul]:pl-6 [&_ul]:list-disc [&_ol]:pl-6 [&_ol]:list-decimal [&_li]:mb-1",
              "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-black",
              "[&_pre]:bg-gray-100 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:text-sm [&_pre]:font-mono",
              "[&_a]:!text-primary [&_a]:underline",
              "[&_hr]:my-4 [&_hr]:border-black",
              "[&_.doc-checklist-item]:flex [&_.doc-checklist-item]:items-start [&_.doc-checklist-item]:gap-2 [&_.doc-checklist-item]:my-1",
              "empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none",
            )}
          />
        </div>

        <SlashCommandMenu
          open={menuOpen}
          onClose={closeMenu}
          position={menuPosition}
          commands={commands}
        />
      </CardContent>
    </Card>
  );
}
