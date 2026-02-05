import { useState } from 'react';
import {
  Circle, ClipboardList, Box, Ruler, FileText, FileCheck, CheckCircle, Calendar,
  Edit2, Check, X, Plus, Trash2, AlertTriangle, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  JourneyStage,
  JourneyStageStatus,
  JourneyTodo,
  useUpdateStage,
  useToggleTodo,
  useUpdateTodo,
  useAddTodo,
  useDeleteTodo,
} from '@/hooks/useProjectJourney';
import { MeetingScheduler } from './MeetingScheduler';

interface JourneyStageCardProps {
  stage: JourneyStage;
  projectId: string;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const statusLabels: Record<JourneyStageStatus, string> = {
  pending: '⚪ Em breve',
  waiting_action: '🟡 Aguardando sua ação',
  in_progress: '🔵 Em andamento',
  completed: '🟢 Concluído',
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'clipboard-list': ClipboardList,
  'box': Box,
  'ruler': Ruler,
  'file-text': FileText,
  'file-check': FileCheck,
  'check-circle': CheckCircle,
  'circle': Circle,
};

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return iconMap[iconName] || Circle;
}

function TodoItem({
  todo,
  projectId,
  isAdmin,
  canCheck,
}: {
  todo: JourneyTodo;
  projectId: string;
  isAdmin: boolean;
  canCheck: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(todo.text);
  
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
        />
        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={handleSave}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={() => setIsEditing(false)}>
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
          toggleTodo.mutate({ todoId: todo.id, completed: !!checked, projectId })
        }
        className="mt-0.5 h-5 w-5"
      />
      <span
        className={cn(
          "flex-1 text-sm leading-relaxed",
          todo.completed && "line-through text-muted-foreground"
        )}
      >
        {todo.text}
      </span>
      {isAdmin && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 md:transition-opacity shrink-0"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function TodoList({
  todos,
  owner,
  label,
  projectId,
  stageId,
  isAdmin,
}: {
  todos: JourneyTodo[];
  owner: 'client' | 'bwild';
  label: string;
  projectId: string;
  stageId: string;
  isAdmin: boolean;
}) {
  const [newTodoText, setNewTodoText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const addTodo = useAddTodo();

  const filteredTodos = todos.filter((t) => t.owner === owner);

  const handleAdd = () => {
    if (!newTodoText.trim()) return;
    addTodo.mutate({ stageId, owner, text: newTodoText, projectId });
    setNewTodoText('');
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
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {filteredTodos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            projectId={projectId}
            isAdmin={isAdmin}
            canCheck={owner === 'client'}
          />
        ))}
        {isAdding && (
          <div className="flex items-center gap-2 py-2">
            <Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Novo item..."
              className="flex-1 h-10 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={handleAdd}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={() => setIsAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function JourneyStageCard({
  stage,
  projectId,
  isAdmin,
  isExpanded,
  onToggleExpand,
}: JourneyStageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: stage.name,
    description: stage.description || '',
    status: stage.status,
    cta_text: stage.cta_text || '',
    cta_visible: stage.cta_visible,
    microcopy: stage.microcopy || '',
    warning_text: stage.warning_text || '',
    dependencies_text: stage.dependencies_text || '',
    revision_text: stage.revision_text || '',
    responsible: stage.responsible || '',
  });
  
  const updateStage = useUpdateStage();
  const Icon = getIcon(stage.icon);

  const handleSave = () => {
    updateStage.mutate({
      stageId: stage.id,
      updates: {
        ...editData,
        description: editData.description || null,
        cta_text: editData.cta_text || null,
        microcopy: editData.microcopy || null,
        warning_text: editData.warning_text || null,
        dependencies_text: editData.dependencies_text || null,
        revision_text: editData.revision_text || null,
        responsible: editData.responsible || null,
      },
      projectId,
    });
    setIsEditing(false);
  };

  const statusBadgeColor = {
    pending: 'bg-muted text-muted-foreground',
    waiting_action: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stage.status === 'waiting_action' && "ring-2 ring-amber-400/50",
        stage.status === 'completed' && "opacity-75"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors p-4 md:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div
                className={cn(
                  "p-2.5 md:p-3 rounded-lg shrink-0",
                  stage.status === 'completed' ? 'bg-green-100' : 
                  stage.status === 'waiting_action' ? 'bg-amber-100' :
                  stage.status === 'in_progress' ? 'bg-blue-100' : 'bg-muted'
                )}
              >
                <Icon className={cn(
                  "h-5 w-5",
                  stage.status === 'completed' ? 'text-green-600' :
                  stage.status === 'waiting_action' ? 'text-amber-600' :
                  stage.status === 'in_progress' ? 'text-blue-600' : 'text-muted-foreground'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start md:items-center gap-2 flex-col md:flex-row">
                  <CardTitle className="text-base md:text-lg leading-tight">{stage.name}</CardTitle>
                  <Badge className={cn("text-[10px] md:text-xs whitespace-nowrap", statusBadgeColor[stage.status])}>
                    {statusLabels[stage.status]}
                  </Badge>
                </div>
                {stage.responsible && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Responsável: {stage.responsible}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="h-10 w-10 flex items-center justify-center">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-5 md:space-y-6 pt-0 px-4 pb-4 md:px-6 md:pb-6">
            {/* Admin Edit Form */}
            {isEditing && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">Editar Etapa</span>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)} className="h-10 w-10">
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={handleSave} disabled={updateStage.isPending} className="h-10 w-10">
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Nome</label>
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <Select
                      value={editData.status}
                      onValueChange={(v) => setEditData({ ...editData, status: v as JourneyStageStatus })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Em breve</SelectItem>
                        <SelectItem value="waiting_action">Aguardando ação</SelectItem>
                        <SelectItem value="in_progress">Em andamento</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Descrição</label>
                  <Textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Texto do CTA</label>
                    <Input
                      value={editData.cta_text}
                      onChange={(e) => setEditData({ ...editData, cta_text: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Responsável</label>
                    <Input
                      value={editData.responsible}
                      onChange={(e) => setEditData({ ...editData, responsible: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Microcopy</label>
                  <Input
                    value={editData.microcopy}
                    onChange={(e) => setEditData({ ...editData, microcopy: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Aviso (warning)</label>
                  <Input
                    value={editData.warning_text}
                    onChange={(e) => setEditData({ ...editData, warning_text: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Dependências</label>
                  <Textarea
                    value={editData.dependencies_text}
                    onChange={(e) => setEditData({ ...editData, dependencies_text: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Revisões</label>
                  <Input
                    value={editData.revision_text}
                    onChange={(e) => setEditData({ ...editData, revision_text: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Description */}
            {stage.description && !isEditing && (
              <div className="prose prose-sm max-w-none text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {stage.description}
              </div>
            )}

            {/* Warning */}
            {stage.warning_text && (
              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">{stage.warning_text}</AlertDescription>
              </Alert>
            )}

            {/* Dependencies */}
            {stage.dependencies_text && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 whitespace-pre-line text-sm">
                  <span className="font-medium">Dependências:</span>
                  <br />
                  {stage.dependencies_text}
                </AlertDescription>
              </Alert>
            )}

            {/* Revision text */}
            {stage.revision_text && (
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                🔁 <span className="font-medium">Revisões:</span> {stage.revision_text}
              </div>
            )}

            {/* Todos */}
            <div className="grid gap-5 md:gap-6 md:grid-cols-2">
              <TodoList
                todos={stage.todos}
                owner="client"
                label="✔️ To-dos do Cliente"
                projectId={projectId}
                stageId={stage.id}
                isAdmin={isAdmin}
              />
              <TodoList
                todos={stage.todos}
                owner="bwild"
                label="🧰 To-dos Bwild"
                projectId={projectId}
                stageId={stage.id}
                isAdmin={isAdmin}
              />
            </div>

            {/* CTA */}
            {stage.cta_visible && stage.cta_text && stage.cta_text.toLowerCase().includes('reunião') ? (
              <div className="pt-2 space-y-2">
                <MeetingScheduler
                  stageId={stage.id}
                  stageName={stage.name}
                  projectId={projectId}
                  isAdmin={isAdmin}
                  ctaText={stage.cta_text}
                />
                {stage.microcopy && (
                  <p className="text-xs text-muted-foreground">{stage.microcopy}</p>
                )}
              </div>
            ) : stage.cta_visible && stage.cta_text ? (
              <div className="pt-2 space-y-2">
                <Button className="w-full md:w-auto min-h-[44px]">
                  {stage.cta_text}
                </Button>
                {stage.microcopy && (
                  <p className="text-xs text-muted-foreground">{stage.microcopy}</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
