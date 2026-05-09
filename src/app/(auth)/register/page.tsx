"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Lock, HelpCircle, AlertTriangle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 进入页面时拉一个建议用户名预填
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/suggest-username");
        const data = await res.json().catch(() => ({}));
        if (data?.username && !username) {
          setUsername(data.username);
        }
      } catch {
        // 忽略，用户手动填即可
      }
    })();
    // 仅首次挂载执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setError(null);
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("用户名 3-20 位，只能含字母 / 数字 / 下划线");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!securityQuestion.trim() || !securityAnswer.trim()) {
      setError("密保问题和答案均为必填");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          securityQuestion,
          securityAnswer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "注册失败");
        return;
      }
      router.replace("/");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-4 my-8">
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">🌸</div>
        <h1 className="text-xl font-semibold text-text">创建账号</h1>
        <p className="text-sm text-text-muted mt-1">零门槛注册，立刻开始学习</p>
      </div>

      <div className="space-y-3.5">
        <label className="block">
          <span className="text-xs text-text-muted mb-1.5 block">用户名</span>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").slice(0, 20))}
              placeholder="3-20 位字母 / 数字 / 下划线"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:border-primary"
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
              placeholder="至少 6 位"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:border-primary"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-text-muted mb-1.5 block">重复密码</span>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value.slice(0, 64))}
              placeholder="再输入一次密码"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                         placeholder:text-text-muted focus:outline-none focus:border-primary"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-text-muted mb-1.5 block">密保问题</span>
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
          <span className="text-xs text-text-muted mb-1.5 block">密保答案</span>
          <input
            type="text"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value.slice(0, 100))}
            placeholder="忘记密码时用，比对时忽略大小写和首尾空格"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                       placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </label>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            密保答案错误 5 次后账号将锁定，需联系管理员人工审批后重置；请务必记牢答案。
          </span>
        </div>

        {error && <div className="text-xs text-red-500">{error}</div>}

        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="w-full py-2.5 text-sm rounded-lg bg-primary text-white font-medium
                     disabled:opacity-50 transition-colors hover:bg-primary/90"
        >
          {submitting ? "创建中..." : "创建账号并登录"}
        </button>

        <div className="text-center text-xs text-text-muted">
          已有账号？{" "}
          <Link href="/login" className="text-primary hover:underline">
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}
