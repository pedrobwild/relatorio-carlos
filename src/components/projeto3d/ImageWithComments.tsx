import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquarePlus, Loader2, Trash2 } from 'lucide-react';
import { use3DComments, type Image3D, type Comment3D } from '@/hooks/use3DVersions';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  image: Image3D;
}

export function ImageWithComments({ image }: Props) {
  const { comments, loading, addComment, updateComment, deleteComment } = use3DComments(image.id);
  const { user } = useAuth();
  const { isStaff } = useUserRole();
  const containerRef = useRef<HTMLDivElement>(null);
  const [addingComment, setAddingComment] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<string | null>(null);

  const getPercentFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (!addingComment) return;
    const pos = getPercentFromEvent(e);
    if (pos) setPendingPin(pos);
  }, [addingComment, getPercentFromEvent]);

  const handleSaveComment = useCallback(async () => {
    if (!pendingPin || !commentText.trim()) return;
    setSaving(true);
    try {
      await addComment({
        imageId: image.id,
        text: commentText.trim(),
        x: pendingPin.x,
        y: pendingPin.y,
      });
      setPendingPin(null);
      setCommentText('');
      setAddingComment(false);
    } finally {
      setSaving(false);
    }
  }, [pendingPin, commentText, addComment, image.id]);

  const handleDragStart = useCallback((commentId: string) => {
    setDragging(commentId);
    setActivePopover(null);
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const pos = getPercentFromEvent(e);
    if (!pos) return;

    // Optimistic UI: move the pin visually
    const el = document.getElementById(`pin-${dragging}`);
    if (el) {
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
    }
  }, [dragging, getPercentFromEvent]);

  const handleDragEnd = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    const pos = getPercentFromEvent(e);
    if (pos) {
      await updateComment({ commentId: dragging, x: pos.x, y: pos.y });
    }
    setDragging(null);
  }, [dragging, getPercentFromEvent, updateComment]);

  const canDeleteComment = useCallback((comment: Comment3D) => {
    return comment.author_user_id === user?.id || isStaff;
  }, [user, isStaff]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Comment mode toggle */}
      <div className="absolute top-3 right-3 z-30 flex gap-2">
        <Button
          variant={addingComment ? 'default' : 'secondary'}
          size="sm"
          className="gap-1.5 shadow-lg"
          onClick={() => {
            setAddingComment(!addingComment);
            setPendingPin(null);
            setCommentText('');
          }}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {addingComment ? 'Cancelar' : 'Comentar'}
        </Button>
      </div>

      {/* Image container with comment pins */}
      <div
        ref={containerRef}
        className={cn(
          "relative inline-block max-w-full max-h-full select-none",
          addingComment && "cursor-crosshair",
          dragging && "cursor-grabbing"
        )}
        onClick={handleContainerClick}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <img
          src={image.url}
          alt="Projeto 3D"
          className="max-w-full max-h-[calc(90vh-140px)] object-contain"
          draggable={false}
          loading="lazy"
        />

        {/* Existing comment pins */}
        {comments.map((comment) => (
          <Popover
            key={comment.id}
            open={activePopover === comment.id}
            onOpenChange={(open) => setActivePopover(open ? comment.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                id={`pin-${comment.id}`}
                className={cn(
                  "absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg border-2 border-background z-10 transition-transform hover:scale-110",
                  dragging === comment.id && "scale-125 ring-2 ring-primary/50",
                  comment.author_user_id === user?.id && "cursor-grab"
                )}
                style={{
                  left: `${comment.x_percent}%`,
                  top: `${comment.y_percent}%`,
                }}
                onMouseDown={(e) => {
                  if (comment.author_user_id === user?.id) {
                    e.stopPropagation();
                    handleDragStart(comment.id);
                  }
                }}
                onTouchStart={(e) => {
                  if (comment.author_user_id === user?.id) {
                    e.stopPropagation();
                    handleDragStart(comment.id);
                  }
                }}
              >
                💬
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="top" align="center">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">{comment.author_name}</p>
                  {canDeleteComment(comment) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteComment(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{comment.text}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(comment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        ))}

        {/* Pending pin (new comment being placed) */}
        {pendingPin && (
          <div
            className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold shadow-lg border-2 border-background z-20 animate-pulse"
            style={{
              left: `${pendingPin.x}%`,
              top: `${pendingPin.y}%`,
            }}
          >
            +
          </div>
        )}
      </div>

      {/* Comment input form (shown when pending pin is placed) */}
      {pendingPin && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-72 bg-card border border-border rounded-lg shadow-xl p-3 space-y-2">
          <Textarea
            placeholder="Escreva seu comentário..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPendingPin(null);
                setCommentText('');
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveComment}
              disabled={saving || !commentText.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
