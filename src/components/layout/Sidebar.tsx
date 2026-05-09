"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Languages,
  FileText,
  MessageSquareText,
  AlertTriangle,
  BarChart3,
  Settings,
  X,
  ChevronDown,
  Users,
  Check,
  LogOut,
  LayoutDashboard,
  ScrollText,
  Pencil,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  Sparkles,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLessonStore } from "@/stores/lessonStore";
import { useAccountStore } from "@/stores/accountStore";
import { useEffect, useState } from "react";

type NavItem =
  | { type: "divider" }
  | { type: "section"; label: string }
  | { href: string; label: string; sublabel: string; icon: typeof BookOpen; appendLesson?: boolean };

const userNavItems: NavItem[] = [
  { href: "/vocabulary", label: "单词", sublabel: "たんご", icon: BookOpen, appendLesson: true },
  { href: "/grammar", label: "语法", sublabel: "ぶんぽう", icon: Languages, appendLesson: true },
  { href: "/examples", label: "例句", sublabel: "れいぶん", icon: MessageSquareText, appendLesson: true },
  { href: "/text", label: "课文", sublabel: "ほんぶん", icon: FileText, appendLesson: true },
  { type: "divider" },
  { href: "/weak-points", label: "薄弱本", sublabel: "ふくしゅう", icon: AlertTriangle },
  { href: "/history", label: "学习记录", sublabel: "きろく", icon: BarChart3 },
  { type: "divider" },
  { href: "/subscribe", label: "开通 AI 会员", sublabel: "プレミアム", icon: Sparkles },
];

const adminNavItems: NavItem[] = [
  { href: "/admin", label: "仪表盘", sublabel: "ダッシュボード", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户管理", sublabel: "ユーザー", icon: Users },
  { href: "/admin/orders", label: "订单管理", sublabel: "ちゅうもん", icon: Receipt },
  { href: "/admin/password-resets", label: "密码重置申请", sublabel: "リセット", icon: KeyRound },
  { type: "divider" },
  { href: "/admin/settings", label: "系统设置", sublabel: "せってい", icon: Settings },
  { href: "/admin/logs", label: "系统日志", sublabel: "ログ", icon: ScrollText },
];


interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { currentLesson } = useLessonStore();
  const { activeProfile, accounts, updateAccount, isAdmin, logout } = useAccountStore();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  // 按当前路径决定显示哪套菜单：在 /admin/* 下就是后台视图，其它都是前台
  const inAdminMode = pathname.startsWith("/admin");
  const navItems = inAdminMode ? adminNavItems : userNavItems;

  // admin 后台：拉待处理的密码重置申请 / 待激活订单数量做小红点
  const [pendingResetCount, setPendingResetCount] = useState(0);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  useEffect(() => {
    if (!isAdmin || !inAdminMode) return;
    let alive = true;
    void (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch("/api/admin/password-resets?scope=pending", { cache: "no-store" }),
          fetch("/api/admin/orders?scope=pending", { cache: "no-store" }),
        ]);
        if (!alive) return;
        if (r1.ok) {
          const d1 = await r1.json();
          setPendingResetCount(d1?.pendingCount ?? 0);
        }
        if (r2.ok) {
          const d2 = await r2.json();
          setPendingOrderCount(d2?.pendingCount ?? 0);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, inAdminMode, pathname]);

  const EMOJI_OPTIONS = [
    "🌸", "🌻", "🌊", "🔥", "🌙", "🍀", "🦊", "🐱",
    "🐻", "🎵", "📚", "🎯", "🏆", "💎", "🌈", "🍣",
  ];

  const handleStartEditProfile = () => {
    setEditName(activeProfile?.displayName || "");
    setEditEmoji(activeProfile?.avatarEmoji || "🌸");
    setEditingProfile(true);
    setShowAccountMenu(false);
  };

  const handleSaveProfile = async () => {
    if (!activeProfile?.id || !editName.trim()) return;
    await updateAccount(activeProfile.id, {
      displayName: editName.trim(),
      avatarEmoji: editEmoji,
    });
    setEditingProfile(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-60 bg-bg-sidebar border-r border-border z-50",
          "flex flex-col transition-transform duration-200 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-border bg-gradient-to-r from-sakura/20 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <span className="font-semibold text-sm text-text tracking-wide">
              {inAdminMode ? "管理面板" : "AI陪练"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-border/50 text-text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          {navItems.map((item, i) => {
            if ("type" in item && item.type === "divider") {
              return (
                <div key={i} className="my-2 border-t border-border" />
              );
            }
            if ("type" in item && item.type === "section") {
              return (
                <div
                  key={i}
                  className="mt-4 mb-1 px-2 text-[10px] font-medium text-text-muted uppercase tracking-wider"
                >
                  {item.label}
                </div>
              );
            }

            if (!("href" in item)) return null;

            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={
                  item.appendLesson
                    ? `${item.href}?lesson=${currentLesson}`
                    : item.href
                }
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text-secondary hover:bg-border/40 hover:text-text"
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "text-[10px] leading-tight",
                      isActive ? "text-primary/60" : "text-text-muted"
                    )}
                  >
                    {item.sublabel}
                  </span>
                </div>
                {item.href === "/admin/password-resets" && pendingResetCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium">
                    {pendingResetCount > 99 ? "99+" : pendingResetCount}
                  </span>
                )}
                {item.href === "/admin/orders" && pendingOrderCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium">
                    {pendingOrderCount > 99 ? "99+" : pendingOrderCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 前后台模式切换：admin 可在前台看到「管理后台」入口；任何在后台的人可「返回学习」 */}
        {inAdminMode ? (
          <Link
            href="/"
            onClick={onClose}
            className="mx-3 my-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                       border border-border text-text-secondary hover:bg-border/40 hover:text-text transition-colors"
          >
            <ArrowLeft size={14} />
            返回学习
          </Link>
        ) : isAdmin ? (
          <Link
            href="/admin"
            onClick={onClose}
            className="mx-3 my-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                       border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            <ShieldCheck size={14} />
            进入管理后台
          </Link>
        ) : null}

        {/* Account switcher */}
        <div className="relative px-3 py-2 border-t border-border">
          {editingProfile ? (
            <div className="px-2 py-2 space-y-2.5">
              <div className="flex flex-wrap gap-1">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEditEmoji(e)}
                    className={`w-7 h-7 rounded-md text-base flex items-center justify-center transition-colors ${
                      editEmoji === e
                        ? "bg-primary/20 ring-1 ring-primary"
                        : "hover:bg-border/40"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="昵称"
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-bg text-sm text-text
                           placeholder:text-text-muted focus:outline-none focus:border-primary"
                onKeyDown={(e) => e.key === "Enter" && void handleSaveProfile()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void handleSaveProfile()}
                  disabled={!editName.trim()}
                  className="flex-1 py-1.5 text-xs rounded-lg bg-primary text-white disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="flex-1 py-1.5 text-xs rounded-lg border border-border text-text-secondary"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-border/40 transition-colors text-sm"
            >
              <span className="text-lg">{activeProfile?.avatarEmoji || "🌸"}</span>
              <div className="flex-1 text-left truncate">
                <span className="text-text">{activeProfile?.displayName || "默认用户"}</span>
                {isAdmin && (
                  <span className="ml-1 text-[10px] text-primary font-medium">管理员</span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  "text-text-muted transition-transform",
                  showAccountMenu && "rotate-180"
                )}
              />
            </button>
          )}

          {showAccountMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-bg-card border border-border rounded-lg shadow-lg py-1 z-50">
              {/* 当前登录账户预览（仅 admin 列表里多个） */}
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <span>{account.avatarEmoji}</span>
                  <div className="flex-1 text-left truncate">
                    <span className="text-text">{account.displayName}</span>
                    {account.role === "admin" && (
                      <span className="ml-1 text-[10px] text-primary font-medium">管理员</span>
                    )}
                  </div>
                  {account.id === activeProfile?.id && (
                    <Check size={14} className="text-primary" />
                  )}
                </div>
              ))}
              {accounts.length > 0 && <div className="border-t border-border my-1" />}
              <button
                onClick={handleStartEditProfile}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-border/40 text-sm text-text-secondary transition-colors"
              >
                <Pencil size={14} />
                修改个人信息
              </button>
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onClose();
                  void logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-border/40 text-sm text-text-secondary transition-colors"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border text-[11px] text-text-muted bg-gradient-to-r from-matcha/8 to-transparent">
          《大家的日语》初级 I · 第1〜25课
        </div>
      </aside>
    </>
  );
}
