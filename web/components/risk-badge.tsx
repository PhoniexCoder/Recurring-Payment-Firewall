"use client";

import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: "LOW" | "MEDIUM" | "HIGH";
  size?: "sm" | "md";
}

export function RiskBadge({ level, size = "md" }: RiskBadgeProps) {
  const styles = {
    LOW: "bg-success/10 text-success border-success/20",
    MEDIUM: "bg-warning/10 text-warning border-warning/20",
    HIGH: "bg-danger/10 text-danger border-danger/20",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        styles[level],
        sizeStyles[size]
      )}
    >
      {level}
    </span>
  );
}

interface DecisionBadgeProps {
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  size?: "sm" | "md";
}

export function DecisionBadge({ decision, size = "md" }: DecisionBadgeProps) {
  const styles = {
    ALLOW: "bg-success/10 text-success border-success/20",
    REVIEW: "bg-warning/10 text-warning border-warning/20",
    BLOCK: "bg-danger/10 text-danger border-danger/20",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        styles[decision],
        sizeStyles[size]
      )}
    >
      {decision}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: "MEDIUM" | "HIGH" | "CRITICAL";
  size?: "sm" | "md";
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const styles = {
    MEDIUM: "bg-warning/10 text-warning border-warning/20",
    HIGH: "bg-danger/10 text-danger border-danger/20",
    CRITICAL: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        styles[severity],
        sizeStyles[size]
      )}
    >
      {severity}
    </span>
  );
}

interface TrustScorePillProps {
  score: number;
}

export function TrustScorePill({ score }: TrustScorePillProps) {
  const getColor = () => {
    if (score >= 80) return "bg-success text-success-foreground";
    if (score >= 50) return "bg-warning text-warning-foreground";
    return "bg-danger text-danger-foreground";
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium",
        getColor()
      )}
    >
      {score}
    </span>
  );
}

interface StatusBadgeProps {
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const styles = {
    OPEN: "bg-danger/10 text-danger border-danger/20",
    ACKNOWLEDGED: "bg-warning/10 text-warning border-warning/20",
    RESOLVED: "bg-success/10 text-success border-success/20",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        styles[status],
        sizeStyles[size]
      )}
    >
      {status}
    </span>
  );
}
