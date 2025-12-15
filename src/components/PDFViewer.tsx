import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  title?: string;
}

const PDFViewer = ({ url, title }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  
  // Swipe handling
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const minSwipeDistance = 50;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
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

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    const isSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSwipe && scale === 1) {
      if (distance > 0) {
        // Swipe left -> next page
        goToNextPage();
      } else {
        // Swipe right -> previous page
        goToPrevPage();
      }
    }
    
    // Reset
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Calculate page width based on container and scale
  const pageWidth = Math.min(containerWidth - 32, 800) * scale;

  return (
    <div className="flex flex-col bg-muted/30 rounded-xl border border-border overflow-hidden">
      {/* PDF Controls - Top */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="h-10 w-10 touch-manipulation"
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
            className="h-10 w-10 touch-manipulation"
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
            className="h-10 w-10 touch-manipulation"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetZoom}
            className="h-10 px-2 touch-manipulation text-xs"
          >
            {Math.round(scale * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 3}
            className="h-10 w-10 touch-manipulation"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* PDF Document with Swipe */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto touch-pan-x touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center p-4">
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
        </div>
      </div>

    </div>
  );
};

export default PDFViewer;
