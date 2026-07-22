import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
}

const TONE: Record<string, string> = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
};

export function StatCard({ title, value, icon, hint, tone = "default" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
          <p className="break-words text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className={cn("shrink-0 rounded-lg p-2 sm:p-2.5", TONE[tone])}>{icon}</div>
        )}
      </CardContent>
    </Card>
  );
}
