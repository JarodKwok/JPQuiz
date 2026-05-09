# 个人收款码图

⚠️ **本目录的 PNG / JPG 图片已被 .gitignore 排除**，避免把真实账号 / 姓名提交到 GitHub。

## 部署后需放置的文件

| 文件名 | 用途 |
|---|---|
| `alipay-monthly.png` | 支付宝固定金额收款码：月度套餐价格 |
| `alipay-yearly.png` | 支付宝固定金额收款码：年度套餐价格 |

## 导出方式

支付宝 App → 我的 → 收钱 → **设置金额**（输入对应套餐金额，如 3 元 / 30 元）→ **保存图片** → 上传到服务器对应位置覆盖。

## 微信通道

`src/app/(app)/subscribe/page.tsx` 里 wechat 通道目前 `enabled: false`（个人微信收款码会显示真实姓名）。需要开通时再补 `wechat-monthly.png` / `wechat-yearly.png` 并把那个 flag 改回 `true`。
