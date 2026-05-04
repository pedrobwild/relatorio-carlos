import { useState, useEffect, useRef } from "react";
import {
  Check,
  X,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  JourneyTodo,
  useToggleTodo,
  useUpdateTodo,
  useAddTodo,
  useDeleteTodo,
} from "@/hooks/useProjectJourney";
import { journeyCopy } from "@/constants/journeyCopy";

interface TodoItemProps {
  todo: JourneyTodo;
  projectId: string;
  isAdmin: boolean;
  canCheck: boolean;
}

function TodoItem({ todo, projectId, isAdmin, canCheck }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(todo.text);

  // Sync text when todo changes externally (e.g. after mutation invalidation)
  useEffect(() => {
    if (!isEditing) setText(todo.text);
  }, [todo.text, isEditing]);

  const toggleTodo = useToggleTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const handleSave = () => {
    updateTodo.mutate({ todoId: todo.id, text, projectId });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 h-10 text-sm"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 shrink-0"
          onClick={handleSave}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 shrink-0"
          onClick={() => setIsEditing(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 shrink-0 text-destructive"
          onClick={() => deleteTodo.mutate({ todoId: todo.id, projectId })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 group min-h-[44px] py-2">
      <Checkbox
        checked={todo.completed}
        disabled={!canCheck && !isAdmin}
        onCheckedChange={(checked) =>
          toggleTodo.mutate({
            todoId: todo.id,
            completed: !!checked,
            projectId,
          })
        }
        className="mt-0.5 h-5 w-5"
      />
      <span
        className={cn(
          "flex-1 text-sm leading-relaxed",
          todo.completed && "line-through text-muted-foreground",
        )}
      >
        {todo.text}
      </span>
      {isAdmin && (
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 min-h-[44px] min-w-[44px] opacity-100 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity shrink-0"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface StageChecklistProps {
  todos: JourneyTodo[];
  owner: "client" | "bwild";
  label: string;
  projectId: string;
  stageId: string;
  isAdmin: boolean;
}

export function StageChecklist({
  todos,
  owner,
  label,
  projectId,
  stageId,
  isAdmin,
}: StageChecklistProps) {
  const [newTodoText, setNewTodoText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const addTodo = useAddTodo();

  const filteredTodos = todos.filter((t) => t.owner === owner);
  const allDone =
    filteredTodos.length > 0 && filteredTodos.every((t) => t.completed);
  const prevAllDone = useRef(allDone);

  // Micro-celebration: detect when all items just became completed
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2500);
      return () => clearTimeout(timer);
    }
    prevAllDone.current = allDone;
  }, [allDone]);

  const handleAdd = () => {
    if (!newTodoText.trim()) return;
    addTodo.mutate({ stageId, owner, text: newTodoText, projectId });
    setNewTodoText("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 min-h-[40px]">
        <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-xs px-3"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> {journeyCopy.checklist.add}
          </Button>
        )}
      </div>
      <div className="space-y-1" role="list" aria-label={label}>
        {filteredTodos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            projectId={projectId}
            isAdmin={isAdmin}
            canCheck={owner === "client"}
          />
        ))}
        {filteredTodos.length === 0 && !isAdding && (
          <div className="flex items-center gap-2 py-3 text-muted-foreground/60">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <p className="text-xs italic">{journeyCopy.checklist.empty}</p>
          </div>
        )}
        {isAdding && (
          <div className="flex items-center gap-2 py-2">
            <Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder={journeyCopy.checklist.newItemPlaceholder}
              className="flex-1 h-10 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 shrink-0"
              onClick={handleAdd}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 shrink-0"
              onClick={() => setIsAdding(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Micro-celebration */}
      {showCelebration && (
        <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--success)/0.06)] border border-[hsl(var(--success)/0.15)] px-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Sparkles className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
          <span className="text-xs font-medium text-[hsl(var(--success))]">
            Tudo certo por aqui! Obrigado pela agilidade.
          </span>
        </div>
      )}
    </div>
  );
}
