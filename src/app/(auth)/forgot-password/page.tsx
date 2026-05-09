"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, HelpCircle, Lock, MessageSquareText } from "lucide-react";

type Step = "username" | "answer" | "reset" | "locked";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startFlow = async () => {
    setError(null);
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 423 || data?.reason === "locked") {
        setStep("locked");
        return;
      }
      if (!res.ok) {
        setError(data?.error || "操作失败");
        return;
      }
      setQuestion(data.question);
      setStep("answer");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer = async () => {
    setError(null);
    if (!answer.trim()) {
      setError("请输入答案");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, answer }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 423 || data?.reason === "locked") {
        setStep("locked");
        return;
      }
      if (!res.ok) {
        setError(data?.error || "答案错误");
        if (typeof data?.attemptsRemaining === "number") {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setAnswer("");
        return;
      }
      setStep("reset");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    if (newPassword.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    // 改密保是可选的，但若填了 question 就必须有 answer
    const wantsChangeQ = newQuestion.trim().length > 0 || newAnswer.trim().length > 0;
    if (wantsChangeQ && (!newQuestion.trim() || !newAnswer.trim())) {
      setError("如要修改密保，问题和答案都需要填写");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: newPassword,
          ...(wantsChangeQ
            ? { securityQuestion: newQuestion, securityAnswer: newAnswer }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "重置失败");
        return;
      }
      router.replace("/");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAdminRequest = async () => {
    setError(null);
    setInfo(null);
    if (!message.trim()) {
      setError("请填写联系方式或留言，便于管理员核实");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot/request-admin-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "提交失败");
        return;
      }
      setInfo(
        "已提交申请，管理员定期审批；通过后用本用户名登录（任意密码即可），系统会引导设置新密码与新密保。"
      );
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-4 my-6">
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">🔐</div>
        <h1 className="text-xl font-semibold text-text">找回密码</h1>
        <p className="text-sm text-text-muted mt-1">
          {step === "username" && "请输入要找回的用户名"}
          {step === "answer" && "请回答你设置的密保问题"}
          {step === "reset" && "设置新的登录密码"}
          {step === "locked" && "账号已锁定，请向管理员留言申请重置"}
        </p>
      </div>

      {step === "username" && (
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
                onKeyDown={(e) => e.key === "Enter" && void startFlow()}
              />
            </div>
          </label>
          {error && <div className="text-xs text-red-500">{error}</div>}
          <button
            onClick={() => void startFlow()}
            disabled={submitting}
            className="w-full py-2.5 text-sm rounded-lg bg-primary text-white font-medium
                       disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {submitting ? "查询中..." : "下一步"}
          </button>
        </div>
      )}

      {step === "answer" && (
        <div className="space-y-4">
          <div className="px-3 py-2.5 rounded-lg border border-border bg-bg-card text-sm text-text">
            <div className="text-[11px] text-text-muted mb-1">密保问题</div>
            <div className="font-medium">{question}</div>
          </div>

          <label className="block">
            <span className="text-xs text-text-muted mb-1.5 block">答案</span>
            <div className="relative">
              <HelpCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value.slice(0, 100))}
                placeholder="比对时忽略大小写和首尾空格"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && void submitAnswer()}
              />
            </div>
          </label>
          {error && (
            <div className="text-xs text-red-500">
              {error}
              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <span className="ml-1 text-text-muted">
                  （剩余 {attemptsRemaining} 次机会）
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => void submitAnswer()}
            disabled={submitting}
            className="w-full py-2.5 text-sm rounded-lg bg-primary text-white font-medium
                       disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {submitting ? "校验中..." : "提交答案"}
          </button>
        </div>
      )}

      {step === "reset" && (
        <div className="space-y-3.5">
          <label className="block">
            <span className="text-xs text-text-muted mb-1.5 block">新密码</span>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.slice(0, 64))}
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

          <details className="text-xs">
            <summary className="cursor-pointer text-text-muted hover:text-primary">
              （可选）顺便修改密保问题与答案
            </summary>
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value.slice(0, 100))}
                placeholder="新密保问题"
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value.slice(0, 100))}
                placeholder="新密保答案"
                className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </details>

          {error && <div className="text-xs text-red-500">{error}</div>}

          <button
            onClick={() => void submitReset()}
            disabled={submitting}
            className="w-full py-2.5 text-sm rounded-lg bg-primary text-white font-medium
                       disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {submitting ? "保存中..." : "保存并登录"}
          </button>
        </div>
      )}

      {step === "locked" && (
        <div className="space-y-4">
          <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 leading-relaxed">
            该账号已锁定。请填写联系方式（如微信号 / 备注），管理员定期审批；通过后用本用户名登录（任意密码即可）即可重设。
          </div>

          <label className="block">
            <span className="text-xs text-text-muted mb-1.5 block">留言（必填）</span>
            <div className="relative">
              <MessageSquareText size={16} className="absolute left-3 top-3 text-text-muted" />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder={`例如：账号 ${username || "your_username"}，请帮我重置；微信 xxx`}
                rows={4}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </label>

          {error && <div className="text-xs text-red-500">{error}</div>}
          {info && <div className="text-xs text-emerald-600">{info}</div>}

          <button
            onClick={() => void submitAdminRequest()}
            disabled={submitting}
            className="w-full py-2.5 text-sm rounded-lg bg-primary text-white font-medium
                       disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {submitting ? "提交中..." : "提交申请"}
          </button>
        </div>
      )}

      <div className="mt-6 text-center text-xs text-text-muted">
        <Link href="/login" className="text-primary hover:underline">
          返回登录
        </Link>
      </div>
    </div>
  );
}
