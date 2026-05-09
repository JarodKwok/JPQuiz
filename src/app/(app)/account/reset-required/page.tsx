"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, HelpCircle, ShieldAlert, LogOut } from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";

export default function ResetRequiredPage() {
  const router = useRouter();
  const { logout, hydrate } = useAccountStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!securityQuestion.trim() || !securityAnswer.trim()) {
      setError("请同时设置新的密保问题和答案");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-after-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, securityQuestion, securityAnswer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "重置失败");
        return;
      }
      // 强制重新拉取 account（清掉 passwordResetPending）
      useAccountStore.setState({ hydrated: false });
      await hydrate();
      router.replace("/");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <ShieldAlert size={32} className="mx-auto mb-2 text-amber-500" />
          <h1 className="text-xl font-semibold text-text">重置账号凭证</h1>
          <p className="text-sm text-text-muted mt-1">
            管理员已批准你的重置申请，请设置新的密码与密保
          </p>
        </div>

        <div className="space-y-3.5">
          <label className="block">
            <span className="text-xs text-text-muted mb-1.5 block">新密码</span>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value.slice(0, 64))}
                placeholder="至少 6 位"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-text-muted mb-1.5 block">重复新密码</span>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.slice(0, 64))}
                placeholder="再输入一次新密码"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-text-muted mb-1.5 block">新密保问题</span>
            <div className="relative">
              <HelpCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value.slice(0, 100))}
                placeholder="例如：我家狗的名字"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-text-muted mb-1.5 block">新密保答案</span>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value.slice(0, 100))}
              placeholder="忘记密码时用，比对忽略大小写和首尾空格"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:border-primary"
            />
          </label>

          {error && <div className="text-xs text-red-500">{error}</div>}

          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="w-full py-2.5 text-sm rounded-lg bg-primary text-white font-medium
                       disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {submitting ? "保存中..." : "保存并继续"}
          </button>

          <button
            onClick={() => void logout()}
            className="w-full inline-flex items-center justify-center gap-1 py-2 text-xs text-text-muted hover:text-primary"
          >
            <LogOut size={12} />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
