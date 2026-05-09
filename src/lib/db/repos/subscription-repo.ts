import { randomBytes } from "crypto";
import { getDb } from "../sqlite";
import { PLAN_PRICES, type PlanKey } from "../config";

export type OrderStatus = "pending" | "paid" | "activated" | "cancelled";
export type PaymentChannel = "alipay" | "wechat" | "other";

export interface SubscriptionOrder {
  id: string;
  userId: string;
  username: string | null;
  displayName: string;
  plan: PlanKey;
  amountCents: number;
  status: OrderStatus;
  userNote: string | null;
  paymentChannel: PaymentChannel;
  createdAt: number;
  paidAt: number | null;
  activatedAt: number | null;
  activatedBy: string | null;
}

interface OrderRow {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string;
  plan: string;
  amount_cents: number;
  status: string;
  user_note: string | null;
  created_at: number;
  paid_at: number | null;
  activated_at: number | null;
  activated_by: string | null;
}

function rowToOrder(row: OrderRow): SubscriptionOrder {
  // user_note 里以前缀 "channel:" 携带支付通道；缺省为 alipay
  let channel: PaymentChannel = "alipay";
  let note = row.user_note ?? "";
  const m = note.match(/^channel:(alipay|wechat|other)\s*\|\s*/);
  if (m) {
    channel = m[1] as PaymentChannel;
    note = note.slice(m[0].length);
  }
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    plan: row.plan as PlanKey,
    amountCents: row.amount_cents,
    status: row.status as OrderStatus,
    userNote: note || null,
    paymentChannel: channel,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    activatedAt: row.activated_at,
    activatedBy: row.activated_by,
  };
}

/** 订单号 JP{yyyymmdd}-{6位 base32}，便于人工对单时一眼分辨日期 */
function generateOrderId(): string {
  const d = new Date();
  const ymd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const suffix = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  return `JP${ymd}-${suffix}`;
}

export interface CreateOrderInput {
  userId: string;
  plan: PlanKey;
  paymentChannel: PaymentChannel;
  userNote: string;
}

/** 用户报付款：写入 pending 订单。每个用户最多 1 条 pending（重复点击复用）。 */
export function createOrReuseOrder(input: CreateOrderInput): SubscriptionOrder {
  const db = getDb();
  const plan = PLAN_PRICES[input.plan];
  if (!plan) throw new Error("invalid plan");

  // 同 user 同 plan 已有 pending → 复用并刷新备注
  const existing = db
    .prepare(
      `SELECT * FROM subscription_orders
        WHERE user_id = ? AND plan = ? AND status = 'pending'
        ORDER BY created_at DESC LIMIT 1`
    )
    .get(input.userId, input.plan) as
    | (OrderRow & { username: never; display_name: never })
    | undefined;

  const noteWithChannel = `channel:${input.paymentChannel}|${input.userNote
    .trim()
    .slice(0, 300)}`;
  const now = Date.now();

  if (existing) {
    db.prepare(
      `UPDATE subscription_orders SET user_note = ?, paid_at = ? WHERE id = ?`
    ).run(noteWithChannel, now, existing.id);
    return getOrderById(existing.id)!;
  }

  const id = generateOrderId();
  db.prepare(
    `INSERT INTO subscription_orders
       (id, user_id, plan, amount_cents, status, user_note, created_at, paid_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).run(id, input.userId, input.plan, plan.cents, noteWithChannel, now, now);

  return getOrderById(id)!;
}

export function getOrderById(orderId: string): SubscriptionOrder | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT o.*, u.username, u.display_name
         FROM subscription_orders o
         JOIN user_profiles u ON u.id = o.user_id
        WHERE o.id = ?`
    )
    .get(orderId) as OrderRow | undefined;
  return row ? rowToOrder(row) : null;
}

export function listMyOrders(userId: string, limit = 20): SubscriptionOrder[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.*, u.username, u.display_name
         FROM subscription_orders o
         JOIN user_profiles u ON u.id = o.user_id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC LIMIT ?`
    )
    .all(userId, limit) as OrderRow[];
  return rows.map(rowToOrder);
}

export function listOrders(scope: "pending" | "all" = "pending", limit = 100): SubscriptionOrder[] {
  const db = getDb();
  const rows =
    scope === "pending"
      ? (db
          .prepare(
            `SELECT o.*, u.username, u.display_name
               FROM subscription_orders o
               JOIN user_profiles u ON u.id = o.user_id
              WHERE o.status = 'pending'
              ORDER BY o.created_at ASC LIMIT ?`
          )
          .all(limit) as OrderRow[])
      : (db
          .prepare(
            `SELECT o.*, u.username, u.display_name
               FROM subscription_orders o
               JOIN user_profiles u ON u.id = o.user_id
              ORDER BY o.created_at DESC LIMIT ?`
          )
          .all(limit) as OrderRow[]);
  return rows.map(rowToOrder);
}

export function countPendingOrders(): number {
  const db = getDb();
  return (db
    .prepare(`SELECT COUNT(*) AS n FROM subscription_orders WHERE status = 'pending'`)
    .get() as { n: number }).n;
}

/** 标记订单已激活；需配合 grantPremium 一起调（事务交给调用方） */
export function markOrderActivated(orderId: string, adminId: string): boolean {
  const db = getDb();
  const info = db
    .prepare(
      `UPDATE subscription_orders
          SET status = 'activated', activated_at = ?, activated_by = ?
        WHERE id = ? AND status IN ('pending', 'paid')`
    )
    .run(Date.now(), adminId, orderId);
  return info.changes > 0;
}

export function cancelOrder(orderId: string, adminId: string): boolean {
  const db = getDb();
  const info = db
    .prepare(
      `UPDATE subscription_orders
          SET status = 'cancelled', activated_at = ?, activated_by = ?
        WHERE id = ? AND status IN ('pending', 'paid')`
    )
    .run(Date.now(), adminId, orderId);
  return info.changes > 0;
}
