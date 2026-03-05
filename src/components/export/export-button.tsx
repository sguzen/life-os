"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportButtonProps {
  href: string;
  label?: string;
  className?: string;
}

export function ExportButton({ href, label = "Export CSV", className }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "export.csv";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium",
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? "Exporting…" : label}
    </button>
  );
}
