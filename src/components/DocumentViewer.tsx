import { useState, useCallback, useRef } from "react";
import { Document, Page } from "react-pdf";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Move,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  RotateCcw,
  Share2,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import "@/lib/pdfWorker";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface DocumentViewerProps {
  url: string;
  title?: string;
  mimeType?: string | null;
  onPageChange?: (page: number) => void;
  showDownload?: boolean;
  className?: string;
}

export function DocumentViewer({ 
  url, 
  title,
  mimeType,
  onPageChange,
  showDownload = true,
  className,
}: DocumentViewerProps) {
  const isMobile = useIsMobile();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const minSwipeDistance = 50;

  const isPdf = mimeType === 'application/pdf' || url?.toLowerCase().includes('.pdf');
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url || '');

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(false);
  };

  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    containerRef.current = node;
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) setContainerWidth(entry.contentRect.width);
      });
      observer.observe(node);
      resizeObserverRef.current = observer;
    }
  }, []);

  const goToPrevPage = () => { const p = Math.max(pageNumber - 1, 1); setPageNumber(p); onPageChange?.(p); };
  const goToNextPage = () => { const p = Math.min(pageNumber + 1, numPages); setPageNumber(p); onPageChange?.(p); };
  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setScale(1);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) { containerRef.current.requestFullscreen?.(); setIsFullscreen(true); }
    else { document.exitFullscreen?.(); setIsFullscreen(false); }
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

  const handleShare = async () => {
    if (!navigator.share) {
      // Fallback: copy URL
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado');
      } catch {
        window.open(url, '_blank');
      }
      return;
    }
    try {
      await navigator.share({ title: title || 'Documento', url });
    } catch {
      // User cancelled share
    }
  };

  const handleRetry = () => {
    setLoadError(false);
    setRetryCount(prev => prev + 1);
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      if (scrollContainerRef.current) setScrollStart({ x: scrollContainerRef.current.scrollLeft, y: scrollContainerRef.current.scrollTop });
      e.preventDefault();
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollStart.x - (e.clientX - panStart.x);
      scrollContainerRef.current.scrollTop = scrollStart.y - (e.clientY - panStart.y);
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
      if (scrollContainerRef.current) setScrollStart({ x: scrollContainerRef.current.scrollLeft, y: scrollContainerRef.current.scrollTop });
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    if (isPanning && scrollContainerRef.current && scale > 1) {
      scrollContainerRef.current.scrollLeft = scrollStart.x - (e.touches[0].clientX - panStart.x);
      scrollContainerRef.current.scrollTop = scrollStart.y - (e.touches[0].clientY - panStart.y);
    }
  };
  const handleTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) > minSwipeDistance && scale === 1 && isPdf) {
      if (distance > 0) goToNextPage(); else goToPrevPage();
    }
    setIsPanning(false);
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const safeContainerWidth = containerWidth > 0 ? containerWidth : 320;
  const pageWidth = Math.min(safeContainerWidth - 32, 800) * scale;

  const errorFallback = (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4 px-4">
      {!navigator.onLine ? (
        <>
          <WifiOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-center">Sem conexão com a internet</p>
          <Button onClick={handleRetry} variant="outline" className="gap-2 h-11 touch-manipulation">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-center">Não foi possível carregar o documento</p>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={handleRetry} variant="outline" className="gap-2 h-11 touch-manipulation">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
            <Button onClick={handleDownload} className="gap-2 h-11 touch-manipulation">
              <Download className="w-4 h-4" /> Baixar arquivo
            </Button>
            <Button variant="outline" onClick={() => window.open(url, '_blank')} className="gap-2 h-11 touch-manipulation">
              <ExternalLink className="w-4 h-4" /> Abrir em nova aba
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      ref={handleContainerRef}
      data-no-swipe
      className={cn("flex flex-col bg-muted/30 rounded-xl border border-border overflow-hidden h-full relative", className)}
    >
      {/* Controls */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-2 bg-card border-b border-border shrink-0">
        {isPdf ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goToPrevPage} disabled={pageNumber <= 1} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Página anterior">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] sm:min-w-[80px] text-center tabular-nums">
              {pageNumber} / {numPages}
            </span>
            <Button variant="ghost" size="icon" onClick={goToNextPage} disabled={pageNumber >= numPages} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Próxima página">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2" />
        )}

        {/* Desktop toolbar */}
        <div className="hidden sm:flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.5} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Diminuir zoom">
            <ZoomOut className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetZoom} className="h-11 min-h-[44px] px-2 touch-manipulation text-xs">
            {Math.round(scale * 100)}%
          </Button>
          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 3} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Aumentar zoom">
            <ZoomIn className="w-5 h-5" />
          </Button>
          {scale > 1 && (
            <div className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Move className="w-3.5 h-3.5" />
              <span>Arraste</span>
            </div>
          )}
          <div className="border-l border-border h-6 mx-2" />
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          {showDownload && (
            <Button variant="ghost" size="icon" onClick={handleDownload} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Baixar documento">
              <Download className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => window.open(url, '_blank')} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Abrir em nova aba">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>

        {/* Mobile toolbar */}
        <div className="flex sm:hidden items-center gap-1">
          {/* Share button — always visible on mobile */}
          <Button variant="ghost" size="icon" onClick={handleShare} className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Compartilhar">
            <Share2 className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation" aria-label="Mais opções">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={zoomIn} disabled={scale >= 3} className="min-h-[44px]">
                <ZoomIn className="w-4 h-4 mr-2" /> Aumentar zoom
              </DropdownMenuItem>
              <DropdownMenuItem onClick={zoomOut} disabled={scale <= 0.5} className="min-h-[44px]">
                <ZoomOut className="w-4 h-4 mr-2" /> Diminuir zoom
              </DropdownMenuItem>
              <DropdownMenuItem onClick={resetZoom} className="min-h-[44px]">
                <RotateCcw className="w-4 h-4 mr-2" /> Zoom {Math.round(scale * 100)}% → 100%
              </DropdownMenuItem>
              {showDownload && (
                <DropdownMenuItem onClick={handleDownload} className="min-h-[44px]">
                  <Download className="w-4 h-4 mr-2" /> Baixar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => window.open(url, '_blank')} className="min-h-[44px]">
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir em nova aba
              </DropdownMenuItem>
              {typeof document !== 'undefined' && document.fullscreenEnabled && (
                <DropdownMenuItem onClick={toggleFullscreen} className="min-h-[44px]">
                  {isFullscreen ? <Minimize2 className="w-4 h-4 mr-2" /> : <Maximize2 className="w-4 h-4 mr-2" />}
                  {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Document Content */}
      <div
        ref={scrollContainerRef}
        className={cn("flex-1 min-h-0 overflow-auto", scale > 1 && "cursor-grab", isPanning && "cursor-grabbing")}
        style={{ WebkitOverflowScrolling: "touch" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center p-4" style={{ minWidth: scale > 1 ? `${pageWidth + 32}px` : 'auto' }}>
          {loadError ? (
            errorFallback
          ) : isPdf ? (
            <Document
              key={retryCount}
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error('[DocumentViewer] PDF load error:', error?.message || error);
                setLoadError(true);
              }}
              loading={
                <div className="flex flex-col items-center justify-center h-64 gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  <span className="text-xs text-muted-foreground">Carregando documento...</span>
                </div>
              }
              error={errorFallback}
            >
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderTextLayer={!isMobile}
                renderAnnotationLayer={!isMobile}
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
                onLoad={() => { setImageLoaded(true); setLoadError(false); }}
                onError={() => setLoadError(true)}
                style={{ transform: `scale(${scale})`, transformOrigin: 'center center', display: imageLoaded ? 'block' : 'none' }}
                className="max-w-full h-auto shadow-lg rounded-lg transition-transform"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4 px-4">
              <p className="text-sm text-center">Pré-visualização não disponível para este tipo de arquivo</p>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button onClick={handleDownload} className="gap-2 h-11 touch-manipulation">
                  <Download className="w-4 h-4" /> Baixar arquivo
                </Button>
                <Button variant="outline" onClick={() => window.open(url, '_blank')} className="gap-2 h-11 touch-manipulation">
                  <ExternalLink className="w-4 h-4" /> Abrir em nova aba
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;
