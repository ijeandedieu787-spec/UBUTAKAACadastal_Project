import React from "react";
import { getStatusColor } from "./helpers";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${getStatusColor(status)} ${className}`}>
      {status}
    </span>
  );
}
