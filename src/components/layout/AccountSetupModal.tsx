"use client";

import { useState } from "react";
import { useAccountStore } from "@/stores/accountStore";

const EMOJI_OPTIONS = [
  "🌸", "🌻", "🌊", "🔥", "🌙", "🍀", "🦊", "🐱",
  "🐻", "🎵", "📚", "🎯", "🏆", "💎", "🌈", "🍣",
];

export default function AccountSetupModal() {
  const { showSetupModal, dismissSetupModal, createAccount } =
    useAccountStore();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌸");
  const [loading, setLoading] = useState(false);

  if (!showSetupModal) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      // migrateDefault = true: 将现有 local-default 数据迁移到新账户
      await createAccount(name.trim(), emoji, true);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
      <div className="bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🌸</div>
          <h2 className="text-lg font-semibold text-text">设置你的学习账户</h2>
          <p className="text-sm text-text-muted mt-1">
            创建一个账户来记录你的学习进度
          </p>
        </div>

        <div className="space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">
              选择头像
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-colors ${
                    emoji === e
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "hover:bg-border/40"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name input */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">
              你的昵称
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 小明"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => void handleCreate()}
              disabled={!name.trim() || loading}
              className="w-full py-2.5 text-sm rounded-lg bg-primary text-white
                         disabled:opacity-50 transition-colors hover:bg-primary/90 font-medium"
            >
              {loading ? "创建中..." : "开始学习"}
            </button>
            <button
              onClick={dismissSetupModal}
              className="w-full py-2 text-xs rounded-lg text-text-muted hover:text-text transition-colors"
            >
              跳过，稍后设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
