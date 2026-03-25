"use client";

import { useState, useCallback, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import AIInputBar from "./AIInputBar";
import AIResponsePanel from "./AIResponsePanel";
import { useLessonStore } from "@/stores/lessonStore";
import { SYSTEM_PROMPT } from "@/services/prompts";
import { streamAIText } from "@/services/ai/client";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const { currentLesson, currentModule, hydrate } = useLessonStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleAISend = useCallback(async (message: string) => {
    setAiLoading(true);
    setAiResponse("");
    setShowPanel(true);

    // 自动附加当前课次上下文
    const contextMessage = `[当前学习：第${currentLesson}课｜模块：${currentModule}]\n${message}`;

    try {
      const fullText = await streamAIText(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextMessage },
        ],
        (_, nextText) => {
          setAiResponse(nextText);
        }
      );

      if (!fullText) {
        setAiResponse("AI 未返回有效内容，请检查 API Key 和模型配置是否正确。");
      }
    } catch (err) {
      setAiResponse(
        `错误: ${err instanceof Error ? err.message : "未知错误"}`
      );
    } finally {
      setAiLoading(false);
    }
  }, [currentLesson, currentModule]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>

        {/* AI Response Panel - between content and input bar */}
        {showPanel && (
          <AIResponsePanel
            content={aiResponse}
            loading={aiLoading}
            lessonId={currentLesson}
            module={currentModule}
            onClose={() => {
              setShowPanel(false);
              setAiResponse("");
            }}
          />
        )}

        <AIInputBar onSend={handleAISend} loading={aiLoading} />
      </div>
    </div>
  );
}
