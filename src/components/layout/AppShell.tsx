"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import AIInputBar from "./AIInputBar";
import AIResponsePanel from "./AIResponsePanel";
import type { AIConversationMessage } from "@/types";
import { useLessonStore } from "@/stores/lessonStore";
import {
  appendConversationMessage,
  getActiveConversation,
  getConversationById,
  listConversationMessages,
  startNewConversation,
  getOrCreateActiveConversation,
} from "@/services/ai/memory";
import { streamTutorReply } from "@/services/ai/tutor";
import { getCurrentUserId } from "@/services/account";
import { useAccountStore } from "@/stores/accountStore";
import AccountSetupModal from "./AccountSetupModal";
import { isMigrationComplete, migrateIndexedDBToServer } from "@/services/migration";

const RESET_REQUIRED_PATH = "/account/reset-required";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [conversationMessages, setConversationMessages] = useState<
    AIConversationMessage[]
  >([]);
  const { currentLesson, currentModule, hydrate, hydrated } = useLessonStore();
  const {
    hydrate: hydrateAccount,
    hydrated: accountHydrated,
    activeProfile,
  } = useAccountStore();
  const [aiEnabled, setAiEnabled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 被 admin 批准重置后，强制把用户挡在 /account/reset-required，
  // 完成新密码设置（password_reset_pending 清零）才放行
  useEffect(() => {
    if (!accountHydrated) return;
    if (activeProfile?.passwordResetPending && pathname !== RESET_REQUIRED_PATH) {
      router.replace(RESET_REQUIRED_PATH);
    }
  }, [accountHydrated, activeProfile?.passwordResetPending, pathname, router]);

  useEffect(() => {
    hydrate();
    void hydrateAccount();

    // One-time data migration: IndexedDB → server SQLite
    if (!isMigrationComplete()) {
      void migrateIndexedDBToServer().then((result) => {
        if (result.success && result.totalInserted > 0) {
          console.log(`[migration] Migrated ${result.totalInserted} records to server`);
        }
        if (!result.success) {
          console.error("[migration] Failed:", result.error);
        }
      });
    }
  }, [hydrate, hydrateAccount]);

  // 拉取 AI 开通状态：未开通 → AIInputBar 整个隐藏。
  // admin 自己也学习时也按 quota 判断（admin 可在 /admin/users 给自己 grant）
  useEffect(() => {
    if (!accountHydrated) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/ai/quota", { cache: "no-store" });
        if (!alive || !res.ok) return;
        const data = await res.json();
        setAiEnabled(!!data.enabled);
      } catch {
        // 网络异常时保持禁用，比误开放安全
      }
    })();
    return () => {
      alive = false;
    };
  }, [accountHydrated]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    void (async () => {
      const activeConversation = await getActiveConversation();
      if (!activeConversation?.id || cancelled) return;

      const messages = await listConversationMessages(activeConversation.id);
      if (cancelled) return;

      setConversationId(activeConversation.id);
      setConversationTitle(activeConversation.title);
      setConversationMessages(messages);
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const handleAISend = useCallback(async (message: string) => {
    setAiLoading(true);
    setShowPanel(true);
    const now = new Date().toISOString();
    const pendingAssistantMessage: AIConversationMessage = {
      conversationId: conversationId || 0,
      ownerId: getCurrentUserId(),
      role: "assistant",
      content: "",
      createdAt: now,
    };

    try {
      const activeConversation =
        conversationId !== null
          ? await getConversationById(conversationId)
          : null;
      const conversation =
        activeConversation ||
        (await getOrCreateActiveConversation({
          lessonId: currentLesson,
          module: currentModule,
        }));

      if (!conversation.id) {
        throw new Error("当前对话初始化失败。");
      }

      const userMessage = await appendConversationMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
      });
      const latestConversation = await getConversationById(conversation.id);

      setConversationId(conversation.id!);
      setConversationTitle(latestConversation?.title || conversation.title);
      setConversationMessages((prev) => [
        ...prev,
        userMessage,
        { ...pendingAssistantMessage, conversationId: conversation.id! },
      ]);

      const fullText = await streamTutorReply(
        {
          conversationId: conversation.id,
          lessonId: currentLesson,
          module: currentModule,
        },
        (_, nextText) => {
          setConversationMessages((prev) => {
            if (prev.length === 0) return prev;

            const nextMessages = [...prev];
            const lastIndex = nextMessages.length - 1;
            const lastMessage = nextMessages[lastIndex];
            if (
              lastMessage &&
              lastMessage.role === "assistant" &&
              !lastMessage.id
            ) {
              nextMessages[lastIndex] = {
                ...lastMessage,
                content: nextText,
              };
            }
            return nextMessages;
          });
        }
      );

      const resolvedText =
        fullText || "AI 未返回有效内容，请检查 API Key 和模型配置是否正确。";
      const assistantMessage = await appendConversationMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: resolvedText,
      });

      setConversationMessages((prev) => {
        if (prev.length === 0) return [assistantMessage];

        const nextMessages = [...prev];
        const lastIndex = nextMessages.length - 1;
        const lastMessage = nextMessages[lastIndex];
        if (
          lastMessage &&
          lastMessage.role === "assistant" &&
          !lastMessage.id
        ) {
          nextMessages[lastIndex] = assistantMessage;
          return nextMessages;
        }

        return [...nextMessages, assistantMessage];
      });

      if (!fullText) {
        return;
      }
    } catch (err) {
      const errorMessage = `错误: ${
        err instanceof Error ? err.message : "未知错误"
      }`;

      setConversationMessages((prev) => {
        if (prev.length === 0) {
          return [
            {
              ...pendingAssistantMessage,
              conversationId: conversationId || 0,
              content: errorMessage,
            },
          ];
        }

        const nextMessages = [...prev];
        const lastIndex = nextMessages.length - 1;
        const lastMessage = nextMessages[lastIndex];
        if (
          lastMessage &&
          lastMessage.role === "assistant" &&
          !lastMessage.id
        ) {
          nextMessages[lastIndex] = {
            ...lastMessage,
            content: errorMessage,
          };
          return nextMessages;
        }

        return [
          ...nextMessages,
          {
            ...pendingAssistantMessage,
            conversationId: conversationId || 0,
            content: errorMessage,
          },
        ];
      });
    } finally {
      setAiLoading(false);
    }
  }, [conversationId, currentLesson, currentModule]);

  const handleNewConversation = useCallback(async () => {
    const conversation = await startNewConversation({
      lessonId: currentLesson,
      module: currentModule,
    });

    setConversationId(conversation.id || null);
    setConversationTitle(conversation.title);
    setConversationMessages([]);
    setShowPanel(true);
  }, [currentLesson, currentModule]);

  return (
    <div className="flex h-screen overflow-hidden">
      <AccountSetupModal />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />

        {/* main + AI 抽屉横向并排，AI 抽屉打开时 main 自动让出空间 */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto relative min-w-0">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
              {children}
            </div>
          </main>

          {/* AI 抽屉：仅开通用户可见，showPanel 控制开/关 */}
          {aiEnabled && showPanel && (
            <aside
              className="
                w-full md:w-[420px] lg:w-[480px] shrink-0
                border-l border-border bg-bg-card flex flex-col
                fixed inset-0 md:relative md:inset-auto z-30
              "
            >
              <AIResponsePanel
                title={conversationTitle}
                messages={conversationMessages}
                loading={aiLoading}
                lessonId={currentLesson}
                module={currentModule}
                onNewConversation={handleNewConversation}
                onClose={() => {
                  setShowPanel(false);
                }}
              />
              <AIInputBar onSend={handleAISend} loading={aiLoading} />
            </aside>
          )}
        </div>

        {/* 折叠时：右下角悬浮唤醒按钮（仅开通用户） */}
        {aiEnabled && !showPanel && (
          <button
            type="button"
            onClick={() => setShowPanel(true)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full
                       bg-primary text-white shadow-lg shadow-primary/30
                       hover:bg-primary/90 transition-all"
            aria-label="打开 AI 陪练"
          >
            <Sparkles size={16} />
            <span className="text-sm font-medium">AI 陪练</span>
          </button>
        )}
      </div>
    </div>
  );
}
