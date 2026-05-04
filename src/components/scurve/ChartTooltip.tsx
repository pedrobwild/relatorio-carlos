interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload?: {
      activity?: string | null;
      date?: string;
    };
  }>;
  label?: string;
}

export const ChartTooltip = ({
  active,
  payload,
  label,
}: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;

  const activity = payload[0]?.payload?.activity;
  const formattedDate = payload[0]?.payload?.date;

  return (
    <div className="bg-card border border-border rounded-xl shadow-xl p-3 sm:p-3.5 min-w-[160px] sm:min-w-[200px] z-50 animate-fade-in transition-all duration-200 ease-out">
      <p className="text-sm sm:text-base font-bold text-foreground mb-2">
        {formattedDate || label}
      </p>

      {activity && (
        <div className="mb-2.5 pb-2.5 border-b border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
            Etapa em execução
          </p>
          <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
            {activity}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.dataKey === "previsto" ? "Previsto" : "Realizado"}
              </span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {entry.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
