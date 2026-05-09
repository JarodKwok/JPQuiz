/**
 * 平台计费 / 配额 集中常量
 *
 * 所有"具体限额"先放这里，后期根据真实数据 / 套餐方案调整都不用改代码逻辑。
 * 未来扩多档套餐时，把这里的 free/premium 平铺改成 tierToQuota 映射即可。
 */

/**
 * 免费用户每月可用 AI 次数。默认 0（禁用），用户线下联系管理员开通才能用。
 * 想给免费试用就调成正数即可（如 3 / 5）。
 */
export const FREE_MONTHLY_QUOTA = 0;

/** 付费会员每月可用 AI 次数（如「5 元 100 次」套餐） */
export const PREMIUM_MONTHLY_QUOTA = 100;

/** 默认套餐价格（仅展示，真正收款走支付宝个人收款码） */
export const PLAN_PRICES = {
  monthly: { cents: 300, durationDays: 30, label: "月度会员" },
  yearly: { cents: 3000, durationDays: 365, label: "年度会员" },
} as const;

export type PlanKey = keyof typeof PLAN_PRICES;

// ── 认证 / 密保 ────────────────────────────────────────────────────────
/** 密保答案累计错答多少次后锁账户 */
export const MAX_RECOVERY_ATTEMPTS = 5;
/** 密码最小长度 */
export const PASSWORD_MIN_LENGTH = 6;
/** 用户名规则：3-20 字符，字母数字下划线 */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
/** 忘记密码 reset cookie：临时凭证 5 分钟有效 */
export const RESET_TOKEN_TTL_MS = 5 * 60 * 1000;
