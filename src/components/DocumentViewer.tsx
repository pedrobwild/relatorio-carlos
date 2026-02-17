import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Move, 
  CheckCircle2, 
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface ApprovalInfo {
  approved_at: string | null;
  approved_by: string | null;
  approver_name?: string | null;
}

interface DocumentViewerProps {
  url: string;
  title?: string;
  mimeType?: string | null;
  /** Approval information for stamp display */
  approval?: ApprovalInfo;
  /** Current page callback for comment linking */
  onPageChange?: (page: number) => void;
  /** Show download button */
  showDownload?: boolean;
  /** Custom className for container */
  className?: string;
}

/**
 * Enhanced document viewer with PDF/image support, approval stamp, and zoom controls
 */
export function DocumentViewer({ 
  url, 
  title,
  mimeType,
  approval,
  onPageChange,
  showDownload = true,
  className,
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Pan/drag state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Swipe handling
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const minSwipeDistance = 50;

  const isPdf = mimeType === 'application/pdf' || url?.toLowerCase().includes('.pdf');
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url || '');
  const isApproved = approval?.approved_at != null;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      containerRef.current = node;
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(node);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const goToPrevPage = () => {
    const newPage = Math.max(pageNumber - 1, 1);
    setPageNumber(newPage);
    onPageChange?.(newPage);
  };

  const goToNextPage = () => {
    const newPage = Math.min(pageNumber + 1, numPages);
    setPageNumber(newPage);
    onPageChange?.(newPage);
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setScale(1);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleDownload = async () => {
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = title || 'documento';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      if (scrollContainerRef.current) {
        setScrollStart({
          x: scrollContainerRef.current.scrollLeft,
          y: scrollContainerRef.current.scrollTop,
        });
      }
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && scrollContainerRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      scrollContainerRef.current.scrollLeft = scrollStart.x - dx;
      scrollContainerRef.current.scrollTop = scrollStart.y - dy;
    }
  };

  const handleMouseUp = () => setIsPanning(false);
  const handleMouseLeave = () => setIsPanning(false);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    if (scale > 1 && e.touches.length === 1) {
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      if (scrollContainerRef.current) {
        setScrollStart({
          x: scrollContainerRef.current.scrollLeft,
          y: scrollContainerRef.current.scrollTop,
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    if (isPanning && scrollContainerRef.current && scale > 1) {
      const dx = e.touches[0].clientX - panStart.x;
      const dy = e.touches[0].clientY - panStart.y;
      scrollContainerRef.current.scrollLeft = scrollStart.x - dx;
      scrollContainerRef.current.scrollTop = scrollStart.y - dy;
    }
  };

  const handleTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    const isSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSwipe && scale === 1 && isPdf) {
      if (distance > 0) goToNextPage();
      else goToPrevPage();
    }
    
    setIsPanning(false);
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const pageWidth = Math.min(containerWidth - 32, 800) * scale;

  return (
    <div 
      ref={handleContainerRef}
      className={cn(
        "flex flex-col bg-muted/30 rounded-xl border border-border overflow-hidden h-full relative",
        className
      )}
    >
      {/* Approval Stamp Overlay */}
      {isApproved && (
        <div className="absolute top-4 right-4 z-20 pointer-events-none">
          <div className="bg-[hsl(var(--success))]/90 text-success-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transform rotate-[-3deg]">
            <CheckCircle2 className="h-5 w-5" />
            <div className="text-sm">
              <div className="font-semibold">APROVADO</div>
              <div className="text-xs opacity-90">
                {approval?.approved_at && format(new Date(approval.approved_at), "dd/MM/yyyy", { locale: ptBR })}
                {approval?.approver_name && ` • ${approval.approver_name}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border shrink-0">
        {isPdf ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              {pageNumber} / {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
              aria-label="Próxima página"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isApproved && (
              <Badge variant="default" className="bg-[hsl(var(--success))] gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Aprovado
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetZoom}
            className="h-11 min-h-[44px] px-2 touch-manipulation text-xs"
          >
            {Math.round(scale * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 3}
            className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>
          
          {scale > 1 && (
            <div className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Move className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Arraste</span>
            </div>
          )}

          <div className="border-l border-border h-6 mx-2" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>

          {showDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
              aria-label="Baixar documento"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(url, '_blank')}
            className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label="Abrir em nova aba"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Document Content */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-auto",
          scale > 1 && "cursor-grab",
          isPanning && "cursor-grabbing"
        )}
        style={{ 
          WebkitOverflowScrolling: "touch",
          maxHeight: "calc(100vh - 200px)",
          minHeight: "400px",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="flex justify-center p-4" 
          style={{ minWidth: scale > 1 ? `${pageWidth + 32}px` : 'auto' }}
        >
          {isPdf ? (
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <p>Erro ao carregar PDF</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline mt-2"
                  >
                    Abrir em nova aba
                  </a>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </Document>
          ) : isImage ? (
            <div className="relative">
              {!imageLoaded && (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              )}
              <img
                src={url}
                alt={title || 'Documento'}
                onLoad={() => setImageLoaded(true)}
                style={{ 
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  display: imageLoaded ? 'block' : 'none',
                }}
                className="max-w-full h-auto shadow-lg rounded-lg transition-transform"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>Pré-visualização não disponível</p>
              <Button onClick={handleDownload} className="mt-4 gap-2">
                <Download className="w-4 h-4" />
                Baixar arquivo
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;
