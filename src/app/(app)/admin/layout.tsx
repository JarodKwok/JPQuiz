"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccountStore } from "@/stores/accountStore";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAdmin, hydrated } = useAccountStore();

  useEffect(() => {
    if (hydrated && !isAdmin) {
      router.replace("/");
    }
  }, [hydrated, isAdmin, router]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        加载中...
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
