interface ReferenceLabelProps {
  viewBox?: { x: number; height: number };
  label: string;
  position?: "top" | "bottom";
  highlight?: boolean;
}

export const ReferenceLabel = ({
  viewBox,
  label,
  position = "top",
  highlight = false,
}: ReferenceLabelProps) => {
  if (!viewBox) return null;
  const { x } = viewBox;

  if (highlight) {
    const estimatedWidth = Math.max(64, label.length * 5.5 + 16);
    const rectHeight = 20;
    return (
      <g>
        <rect
          x={x - estimatedWidth / 2}
          y={1}
          width={estimatedWidth}
          height={rectHeight}
          rx={5}
          fill="hsl(var(--primary))"
        />
        <text
          x={x}
          y={14.5}
          fill="white"
          fontSize={9}
          textAnchor="middle"
          fontWeight={700}
        >
          {label}
        </text>
      </g>
    );
  }

  return (
    <text
      x={x}
      y={position === "top" ? 16 : (viewBox.height ?? 0) - 4}
      fill="hsl(var(--muted-foreground))"
      fontSize={8}
      textAnchor="middle"
      fontWeight={500}
    >
      {label}
    </text>
  );
};
