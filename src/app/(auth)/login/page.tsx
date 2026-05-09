"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "登录失败");
        return;
      }
      if (data?.passwordResetPending) {
        router.replace("/account/reset-required");
      } else {
        router.replace("/");
      }
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-4">
      <div className="text-center mb-8">
        <div className="text-3xl mb-2">🌸</div>
        <h1 className="text-xl font-semibold text-text">日语陪练</h1>
        <p className="text-sm text-text-muted mt-1">用户名 + 密码登录</p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-text-muted mb-1.5 block">用户名</span>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").slice(0, 20))}
              placeholder="请输入用户名"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-text-muted mb-1.5 block">密码</span>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 64))}
              placeholder="请输入密码"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
        </label>

        {error && <div className="text-xs text-red-500">{error}</div>}

        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="w-full py-2.5 text-sm rounded-lg bg-primary text-white font-medium
                     disabled:opacity-50 transition-colors hover:bg-primary/90"
        >
          {submitting ? "登录中..." : "登录"}
        </button>

        <div className="flex items-center justify-between text-xs">
          <Link href="/forgot-password" className="text-text-muted hover:text-primary">
            忘记密码？
          </Link>
          <Link href="/register" className="text-primary hover:underline">
            注册账号
          </Link>
        </div>
      </div>
    </div>
  );
}
