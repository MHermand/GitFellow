import type { StatusLevel } from "@/lib/report";

const COLOR: Record<StatusLevel, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  critical: "text-critical",
  neutral: "text-muted",
};

/** Pictogramme d'état : la couleur ne porte jamais seule l'information (icône + libellé). */
export function StatusIcon({ level, title }: { level: StatusLevel; title?: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  let path: React.ReactNode;
  switch (level) {
    case "good":
      path = <path d="M3 8.5l3 3 7-7" />;
      break;
    case "warning":
      path = <path d="M8 3v6M8 12.5v.5" />;
      break;
    case "serious":
      path = <path d="M8 3v10M4 9l4 4 4-4" />;
      break;
    case "critical":
      path = <path d="M4 4l8 8M12 4l-8 8" />;
      break;
    default:
      path = <path d="M4 8h8" />;
  }
  return (
    <span className={`inline-flex shrink-0 ${COLOR[level]}`} title={title}>
      <svg {...common}>{path}</svg>
    </span>
  );
}
