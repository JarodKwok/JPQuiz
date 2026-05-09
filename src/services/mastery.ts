import type { Module, MasteryLevel, MasteryStatus } from "@/types";
import { emitDataUpdated } from "./events";

/** Save or update mastery status for a knowledge item */
export async function saveMastery(
  lessonId: number,
  module: Module,
  itemKey: string,
  status: MasteryLevel
) {
  await fetch("/api/db/mastery/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, module, itemKey, status }),
  });
  emitDataUpdated();
}

/** Get mastery status for items in a lesson+module */
export async function getMasteryMap(
  lessonId: number,
  module: Module
): Promise<Record<string, MasteryLevel>> {
  const res = await fetch(
    `/api/db/mastery/map?lessonId=${lessonId}&module=${encodeURIComponent(module)}`
  );
  if (!res.ok) return {};
  return res.json();
}

/** Get weak/fuzzy items, optionally filtered by lesson */
export async function getWeakItems(lessonId?: number): Promise<MasteryStatus[]> {
  const params = new URLSearchParams();
  if (lessonId !== undefined) params.set("lessonId", String(lessonId));
  const res = await fetch(`/api/db/mastery/weak-items?${params}`);
  if (!res.ok) return [];
  return res.json();
}

/** Update a mastery item status (e.g. mark as mastered from weak-points page) */
export async function updateMasteryById(id: number, status: MasteryLevel) {
  await fetch("/api/db/mastery/update-by-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  emitDataUpdated();
}

/** Delete a mastery record */
export async function deleteMasteryById(id: number) {
  await fetch("/api/db/mastery/delete-by-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  emitDataUpdated();
}
