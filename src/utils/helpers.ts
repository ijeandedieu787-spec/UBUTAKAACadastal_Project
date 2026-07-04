export function generateId(prefix = ""): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  const id = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}-${id}` : id;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Approved": case "Completed": case "Resolved": return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "Pending": case "Draft": case "Filed": case "Unpaid": return "text-amber-600 bg-amber-50 border-amber-200";
    case "Active": case "Flying": case "Investigation": return "text-blue-600 bg-blue-50 border-blue-200";
    case "Rejected": case "Disputed": return "text-rose-600 bg-rose-50 border-rose-200";
    case "Paid": return "text-emerald-600 bg-emerald-50 border-emerald-200";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} RWF`;
}

export function formatArea(sqMeters: number): string {
  return `${sqMeters.toLocaleString()} sqm (${(sqMeters / 10000).toFixed(3)} ha)`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function getSeverityColor(severity: "info" | "warning" | "critical"): string {
  switch (severity) {
    case "critical": return "text-rose-600 bg-rose-50 border-rose-200";
    case "warning": return "text-amber-600 bg-amber-50 border-amber-200";
    default: return "text-blue-600 bg-blue-50 border-blue-200";
  }
}
