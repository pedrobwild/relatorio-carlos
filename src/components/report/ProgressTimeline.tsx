import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoomProgress } from "@/types/weeklyReport";
import { ComparisonModal } from "./progress-timeline/ComparisonModal";
import { MobileRoomCard } from "./progress-timeline/MobileRoomCard";
import { DesktopRoomCard } from "./progress-timeline/DesktopRoomCard";

interface ProgressTimelineProps {
  rooms: RoomProgress[];
}

const ProgressTimeline = ({ rooms }: ProgressTimelineProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomProgress | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(
    null,
  );
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  const triggerHaptic = useCallback((pattern: number | number[] = 10) => {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  }, []);

  const navigateTo = useCallback(
    (newIndex: number, direction: "left" | "right") => {
      triggerHaptic(10);
      setSlideDirection(direction);
      setCurrentIndex(newIndex);
      setTimeout(() => setSlideDirection(null), 300);
    },
    [triggerHaptic],
  );

  const handlePrevious = useCallback(() => {
    navigateTo(currentIndex > 0 ? currentIndex - 1 : rooms.length - 1, "right");
  }, [currentIndex, rooms.length, navigateTo]);

  const handleNext = useCallback(() => {
    navigateTo(currentIndex < rooms.length - 1 ? currentIndex + 1 : 0, "left");
  }, [currentIndex, rooms.length, navigateTo]);

  const openComparison = (room: RoomProgress) => {
    triggerHaptic(15);
    setSelectedRoom(room);
    setShowComparison(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) setSwipeOffset(deltaX);
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const timeDelta = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(swipeOffset) / timeDelta;
    if (Math.abs(swipeOffset) > 50 || velocity > 0.3) {
      if (swipeOffset > 0) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
    touchStartRef.current = null;
    setSwipeOffset(0);
    setIsSwiping(false);
  };

  if (rooms.length === 0) return null;

  const completedCount = rooms.filter((r) => r.status === "concluído").length;
  const progressPercent = Math.round((completedCount / rooms.length) * 100);

  return (
    <>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-h2">Evolução por Ambiente</h3>
              <p className="text-tiny text-muted-foreground">
                {completedCount} de {rooms.length} concluídos ({progressPercent}
                %)
              </p>
            </div>
            <div className="flex sm:hidden items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrevious}
                aria-label="Cômodo anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-tiny text-muted-foreground min-w-[40px] text-center">
                {currentIndex + 1}/{rooms.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleNext}
                aria-label="Próximo cômodo"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden sm:block p-3">
          <div className="grid grid-cols-2 gap-3">
            {rooms.map((room) => (
              <DesktopRoomCard
                key={room.id}
                room={room}
                onCompare={() => openComparison(room)}
              />
            ))}
          </div>
        </div>

        {/* Mobile swipe */}
        <div
          className="sm:hidden overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            key={currentIndex}
            className={cn(
              "p-3",
              !isSwiping &&
                slideDirection === "left" &&
                "animate-slide-in-from-right",
              !isSwiping &&
                slideDirection === "right" &&
                "animate-slide-in-from-left",
            )}
            style={{
              transform: isSwiping
                ? `translateX(${swipeOffset * 0.3}px)`
                : undefined,
              opacity: isSwiping ? 1 - Math.abs(swipeOffset) / 500 : undefined,
            }}
          >
            <MobileRoomCard
              room={rooms[currentIndex]}
              onCompare={() => openComparison(rooms[currentIndex])}
            />
          </div>
          {currentIndex === 0 && (
            <div className="flex items-center justify-center gap-1 text-tiny text-muted-foreground pb-2 animate-pulse">
              <ChevronLeft className="w-3 h-3" />
              <span>Deslize para navegar</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          )}
          <div className="flex justify-center gap-1.5 pb-3">
            {rooms.map((room, index) => (
              <button
                key={room.id}
                onClick={() => {
                  if (index !== currentIndex)
                    navigateTo(index, index > currentIndex ? "left" : "right");
                }}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === currentIndex
                    ? "bg-primary w-6"
                    : room.status === "concluído"
                      ? "bg-emerald-500/50 w-2"
                      : "bg-muted-foreground/30 w-2",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <ComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        render3D={selectedRoom?.render3D}
        realPhoto={selectedRoom?.after}
        roomName={selectedRoom?.name || ""}
      />
    </>
  );
};

export default ProgressTimeline;
