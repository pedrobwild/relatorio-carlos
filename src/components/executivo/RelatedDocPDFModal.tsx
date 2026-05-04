import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, type LucideIcon } from "lucide-react";
import PDFViewer from "@/components/PDFViewer";
import type { ProjectDocument } from "@/hooks/useDocuments";

interface Props {
  doc: ProjectDocument;
  icon: LucideIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
}

export function RelatedDocPDFModal({
  doc,
  icon: Icon,
  open,
  onOpenChange,
  trigger,
}: Props) {
  const handleDownload = async () => {
    if (!doc.url) return;
    const response = await fetch(doc.url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95dvh] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pr-12 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">{doc.name}</span>
            </DialogTitle>
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-2">
          <PDFViewer url={doc.url!} title={doc.name} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
