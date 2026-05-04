import type { GanttTask, BarStyle } from "./types";

interface GanttDebugColumnProps {
  ganttTasks: GanttTask[];
  getBarStyle: (start: string, end: string) => BarStyle;
}

export function GanttDebugColumn({
  ganttTasks,
  getBarStyle,
}: GanttDebugColumnProps) {
  return (
    <div className="flex-shrink-0 w-72 border-r border-border bg-amber-50/50 overflow-hidden">
      <div className="h-8 border-b border-border bg-amber-100/50 flex items-center px-2">
        <span className="text-[10px] font-mono font-bold text-amber-800">
          🐛 DEBUG: Datas & Estilos
        </span>
      </div>
      {ganttTasks.map((task, index) => {
        const plannedStyle = getBarStyle(task.plannedStart, task.plannedEnd);
        const actualStyle =
          task.statusTabela !== "PENDENTE"
            ? getBarStyle(task.start, task.end)
            : null;

        return (
          <div
            key={`debug-${index}`}
            className="h-12 px-2 py-1 border-b border-amber-200 text-[9px] font-mono leading-tight overflow-hidden"
          >
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-amber-700">
                  <span className="text-amber-500">P:</span> {task.plannedStart}{" "}
                  → {task.plannedEnd}
                </div>
                <div className="text-green-700">
                  <span className="text-green-500">A:</span> {task.start || "—"}{" "}
                  → {task.end || "—"}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-blue-700">
                  <span className="text-blue-500">L:</span> {plannedStyle.left}
                  <span className="text-blue-500 ml-1">W:</span>{" "}
                  {plannedStyle.width}
                </div>
                {actualStyle && (
                  <div className="text-purple-700">
                    <span className="text-purple-500">L:</span>{" "}
                    {actualStyle.left}
                    <span className="text-purple-500 ml-1">W:</span>{" "}
                    {actualStyle.width}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">
              status={task.statusTabela} | prog={task.progress}% | delay=
              {task.delayDays}d
            </div>
          </div>
        );
      })}
    </div>
  );
}
