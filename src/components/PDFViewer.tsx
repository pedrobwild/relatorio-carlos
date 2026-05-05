import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Move,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/lib/pdfWorker";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PDFViewerProps {
  url: string;
  title?: string;
}

const PDF_LOAD_TIMEOUT_MS = 30_000;

const PDFViewer = ({ url, title: _title }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pan/drag state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Swipe handling (for page navigation when not zoomed)
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const minSwipeDistance = 50;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoadTimedOut(false);
    setNumPages(numPages);
  };

  // Start/reset timeout when url or retryKey changes
  useEffect(() => {
    setLoadTimedOut(false);
    timeoutRef.current = setTimeout(() => {
      if (numPages === 0) setLoadTimedOut(true);
    }, PDF_LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [url, retryKey]);

  const handleRetry = () => {
    setNumPages(0);
    setLoadTimedOut(false);
    setRetryKey((k) => k + 1);
  };

  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    containerNodeRef.current = node;
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      resizeObserverRef.current = observer;
    }
  }, []);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1);
  };

  // Mouse drag handlers for panning when zoomed
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

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Touch handlers for swipe (page nav) and pan (when zoomed)
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

    // Only navigate pages when not zoomed
    if (isSwipe && scale === 1) {
      if (distance > 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }

    setIsPanning(false);
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Calculate page width based on container and scale
  const safeContainerWidth = containerWidth > 0 ? containerWidth : 320;
  const pageWidth = Math.min(safeContainerWidth - 32, 800) * scale;

  return (
    <div
      data-no-swipe
      className="flex flex-col bg-muted/30 rounded-xl border border-border overflow-hidden h-full"
    >
      {/* PDF Controls - Top */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border shrink-0">
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
              <span className="hidden sm:inline">Arraste para navegar</span>
            </div>
          )}
        </div>
      </div>

      {/* PDF Document with Scroll/Pan */}
      <div
        ref={(node: HTMLDivElement | null) => {
          containerRef(node);
          (
            scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
          ).current = node;
        }}
        className={cn(
          "flex-1 min-h-0 overflow-auto",
          scale > 1 && "cursor-grab",
          isPanning && "cursor-grabbing",
        )}
        style={{
          WebkitOverflowScrolling: "touch",
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
          style={{ minWidth: scale > 1 ? `${pageWidth + 32}px` : "auto" }}
        >
          {loadTimedOut ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="font-medium">Tempo limite ao carregar PDF</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Document
              key={retryKey}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
