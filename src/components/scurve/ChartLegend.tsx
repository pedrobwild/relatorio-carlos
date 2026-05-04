export const ChartLegend = () => (
  <div className="flex items-center justify-center gap-6 sm:gap-8 mt-3 sm:mt-4 pt-3 border-t border-border/30">
    <div className="flex items-center gap-2">
      <span
        className="w-6 h-0.5 bg-primary opacity-50"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, hsl(var(--primary)) 0px, hsl(var(--primary)) 4px, transparent 4px, transparent 6px)",
        }}
      />
      <span className="text-xs sm:text-sm text-muted-foreground">Previsto</span>
    </div>
    <div className="flex items-center gap-2">
      <span
        className="w-6 h-1 rounded-full"
        style={{ backgroundColor: "#22c55e" }}
      />
      <span
        className="text-xs sm:text-sm font-semibold"
        style={{ color: "#22c55e" }}
      >
        Realizado
      </span>
    </div>
  </div>
);
