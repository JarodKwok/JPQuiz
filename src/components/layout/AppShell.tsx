"use client";

import { useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import AIInputBar from "./AIInputBar";
import AIResponsePanel from "./AIResponsePanel";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const handleAISend = useCallback(async (message: string) => {
    setAiLoading(true);
    setAiResponse("");
    setShowPanel(true);

    try {
      const settingsRaw = localStorage.getItem("jpquiz-ai-settings");
      if (!settingsRaw) {
        setAiResponse("请先在「设置」页面配置 AI 模型和 API Key。");
        setAiLoading(false);
        return;
      }

      const settings = JSON.parse(settingsRaw);
      const provider = settings.activeProvider || "openai";
      const config = settings.providers?.[provider];

      if (!config?.apiKey) {
        setAiResponse("请先在「设置」页面配置 API Key。");
        setAiLoading(false);
        return;
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "あなたは日語N5 AI辅导助手です。《大家的日语》初級Iに基づいて学習をサポートします。説明は中国語で行います。",
            },
            { role: "user", content: message },
          ],
          provider,
          config,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        // Try to parse JSON error
        try {
          const errJson = JSON.parse(errText);
          setAiResponse(`请求失败: ${errJson.error || errText}`);
        } catch {
          setAiResponse(`请求失败 (${res.status}): ${errText}`);
        }
        setAiLoading(false);
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      // If response is JSON (non-streaming), read directly
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const content =
          data.choices?.[0]?.message?.content ||
          data.choices?.[0]?.delta?.content ||
          data.error ||
          "AI 未返回有效内容。";
        setAiResponse(content);
        setAiLoading(false);
        return;
      }

      // Handle streaming SSE response
      const reader = res.body?.getReader();
      if (!reader) {
        setAiResponse("无法读取响应流。");
        setAiLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                setAiResponse(fullText);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim() && buffer.trim().startsWith("data: ")) {
        const data = buffer.trim().slice(6);
        if (data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAiResponse(fullText);
            }
          } catch {
            // skip
          }
        }
      }

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
  }, []);

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
