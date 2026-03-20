"use client";

import { X, Loader2 } from "lucide-react";

interface AIResponsePanelProps {
  content: string;
  loading: boolean;
  onClose: () => void;
}

export default function AIResponsePanel({
  content,
  loading,
  onClose,
}: AIResponsePanelProps) {
  return (
    <div className="border-t border-border bg-bg-card shrink-0">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>🤖</span>
            <span>AI 助手</span>
            {loading && (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>思考中...</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-border/50 text-text-muted"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-4 py-3 max-h-64 overflow-y-auto text-sm text-text leading-relaxed whitespace-pre-wrap">
          {content || (loading ? "正在生成回答..." : "")}
        </div>
      </div>
    </div>
  );
}
