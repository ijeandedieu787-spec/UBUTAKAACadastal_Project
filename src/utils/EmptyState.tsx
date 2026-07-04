import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
}

export default function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      {icon && <div className="w-6 h-6 text-slate-300 mx-auto mb-1.5">{icon}</div>}
      <p className="text-[11px] text-slate-400 font-sans">{message}</p>
    </div>
  );
}
