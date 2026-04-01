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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLessonStore } from "@/stores/lessonStore";

const navItems = [
  { href: "/vocabulary", label: "单词", sublabel: "たんご", icon: BookOpen },
  { href: "/grammar", label: "语法", sublabel: "ぶんぽう", icon: Languages },
  { href: "/examples", label: "例句", sublabel: "れいぶん", icon: MessageSquareText },
  { href: "/text", label: "课文", sublabel: "ほんぶん", icon: FileText },
  { type: "divider" as const },
  { href: "/weak-points", label: "薄弱本", sublabel: "ふくしゅう", icon: AlertTriangle },
  { href: "/history", label: "学习记录", sublabel: "きろく", icon: BarChart3 },
  { type: "divider" as const },
  { href: "/settings", label: "设置", sublabel: "せってい", icon: Settings },
] as const;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { currentLesson } = useLessonStore();

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
        <div className="flex items-center justify-between px-5 h-14 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <span className="font-semibold text-sm text-text tracking-wide">
              AI陪练
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

            if (!("href" in item)) return null;

            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={
                  item.href === "/vocabulary" ||
                  item.href === "/grammar" ||
                  item.href === "/text" ||
                  item.href === "/examples"
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
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border text-[11px] text-text-muted">
          《大家的日语》初级 I · 第1〜25课
        </div>
      </aside>
    </>
  );
}
