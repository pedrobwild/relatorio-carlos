import { useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { Zap, ArrowRight, Edit2, Save, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InlineRichEditor } from "@/components/ui/inline-rich-editor";
import { usePageInstructions } from "@/hooks/usePageInstructions";

const PAGE_KEY = "ligacao_energia";

const DEFAULT_CONTENT = `<p>Como proprietário, é preciso que você solicite a ligação da energia elétrica para que possamos trabalhar. Você pode fazer a solicitação online, de forma rápida, pelo site da ENEL. Segue o passo a passo:</p>
<ol>
<li>Acesse o site: <a href="https://www.enel.com.br" target="_blank" rel="noopener noreferrer">www.enel.com.br</a></li>
<li>Clique em <strong>"Agência Virtual"</strong></li>
<li>Depois, selecione a opção <strong>"Ligação Nova"</strong> ou <strong>"Nova Conexão"</strong></li>
<li>Preencha os dados do imóvel e envie os documentos solicitados (normalmente RG, CPF e comprovante de posse do imóvel)</li>
<li>Ao final, será gerado um <strong>número de protocolo</strong></li>
</ol>
<p>Esse número de protocolo é muito importante para nós, pois com ele conseguimos acompanhar o andamento da solicitação junto à ENEL e nos programar internamente para o início da obra assim que a energia for liberada.</p>
<p><strong>Assim que finalizar, nos envie no e-mail victorya@bwild.com.br.</strong></p>`;

const contentVariants = {
  collapsed: { height: 0, opacity: 0, overflow: "hidden" as const },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "visible" as const,
    transition: {
      height: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden" as const,
    transition: {
      height: {
        duration: 0.25,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.15 },
    },
  },
};

interface WelcomeEnergyCardProps {
  projectId: string;
  isAdmin: boolean;
}

export function WelcomeEnergyCard({
  projectId,
  isAdmin,
}: WelcomeEnergyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { instruction, loading, save } = usePageInstructions(
    projectId,
    PAGE_KEY,
  );

  const displayContent = instruction?.content_html || DEFAULT_CONTENT;

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraft(displayContent);
      setEditing(true);
    },
    [displayContent],
  );

  const cancelEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
    setDraft("");
  }, []);

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await save(draft);
      setEditing(false);
    },
    [draft, save],
  );

  return (
    <Card className="transition-shadow duration-200 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        aria-label="Ligação de Energia"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">
              Ligação de Energia
            </h3>
            <p className="text-xs text-amber-600 font-medium">
              Ação necessária do proprietário
            </p>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="energy-content"
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
          >
            <CardContent className="space-y-4 pt-0 px-4 pb-5 md:px-6 md:pb-6">
              {isAdmin && !editing && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={startEditing}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              )}

              {editing ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <InlineRichEditor
                    value={draft}
                    onChange={setDraft}
                    placeholder="Instruções sobre ligação de energia..."
                    minHeight="200px"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={cancelEditing}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={handleSave}>
                      <Save className="h-3.5 w-3.5" />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : loading ? (
                <div className="h-24 animate-pulse rounded bg-muted/40" />
              ) : (
                <div
                  className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-3"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(displayContent),
                  }}
                />
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
