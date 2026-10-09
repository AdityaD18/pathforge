import { BarChart3, Compass, Cpu, FlaskConical, LayoutTemplate, MessageSquareText, Server } from "lucide-react";

const ICONS = {
  "bar-chart-3": BarChart3,
  "flask-conical": FlaskConical,
  cpu: Cpu,
  "message-square-text": MessageSquareText,
  "layout-template": LayoutTemplate,
  server: Server,
} as const;

export function CareerIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Compass;
  return <Icon className={className} />;
}
