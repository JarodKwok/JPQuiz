import { db } from "./db";
import type { Module, MasteryLevel, MasteryStatus } from "@/types";

/** Save or update mastery status for a knowledge item */
export async function saveMastery(
  lessonId: number,
  module: Module,
  itemKey: string,
  status: MasteryLevel
) {
  const existing = await db.masteryStatus
    .where("[lessonId+module+itemKey]")
    .equals([lessonId, module, itemKey])
    .first();

  if (existing) {
    await db.masteryStatus.update(existing.id!, {
      status,
      reviewCount: existing.reviewCount + 1,
      lastReviewedAt: new Date().toISOString(),
    });
  } else {
    await db.masteryStatus.add({
      lessonId,
      module,
      itemKey,
      status,
      reviewCount: 1,
      lastReviewedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }
}

/** Get mastery status for items in a lesson+module */
export async function getMasteryMap(
  lessonId: number,
  module: Module
): Promise<Record<string, MasteryLevel>> {
  const items = await db.masteryStatus
    .where({ lessonId, module })
    .toArray();

  const map: Record<string, MasteryLevel> = {};
  for (const item of items) {
    map[item.itemKey] = item.status;
  }
  return map;
}

/** Get all weak/fuzzy items across all lessons */
export async function getWeakItems(): Promise<MasteryStatus[]> {
  return db.masteryStatus
    .where("status")
    .anyOf(["weak", "fuzzy"])
    .toArray();
}

/** Update a mastery item status (e.g. mark as mastered from weak-points page) */
export async function updateMasteryById(id: number, status: MasteryLevel) {
  await db.masteryStatus.update(id, {
    status,
    reviewCount: (await db.masteryStatus.get(id))!.reviewCount + 1,
    lastReviewedAt: new Date().toISOString(),
  });
}

/** Delete a mastery record */
export async function deleteMasteryById(id: number) {
  await db.masteryStatus.delete(id);
}
