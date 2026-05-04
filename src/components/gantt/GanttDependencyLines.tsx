import type { DependencyLine, BarStyle } from "./types";

interface GanttDependencyLinesProps {
  dependencyLines: DependencyLine[];
  getBarStyle: (start: string, end: string) => BarStyle;
}

export function GanttDependencyLines({
  dependencyLines,
  getBarStyle,
}: GanttDependencyLinesProps) {
  if (dependencyLines.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {dependencyLines.map((line, idx) => {
        const fromEnd = getBarStyle(
          line.fromActivity.plannedStart,
          line.fromActivity.plannedEnd,
        );
        const toStart = getBarStyle(
          line.toActivity.plannedStart,
          line.toActivity.plannedEnd,
        );

        const fromX = parseFloat(fromEnd.left) + parseFloat(fromEnd.width);
        const toX = parseFloat(toStart.left);
        const fromY = line.fromIndex * 48 + 14;
        const toY = line.toIndex * 48 + 14;

        const strokeColor = "hsl(var(--primary))";
        const markerId = `arrowhead-${idx}`;

        return (
          <svg
            key={`line-${idx}`}
            className="absolute inset-0 w-full h-full overflow-visible"
            style={{ zIndex: 5 }}
            preserveAspectRatio="none"
          >
            <line
              x1={`${fromX}%`}
              y1={fromY}
              x2={`${toX}%`}
              y2={toY}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray="4,3"
              opacity="0.5"
              markerEnd={`url(#${markerId})`}
            />
            <defs>
              <marker
                id={markerId}
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 6 3, 0 6"
                  fill={strokeColor}
                  opacity="0.5"
                />
              </marker>
            </defs>
          </svg>
        );
      })}
    </div>
  );
}
