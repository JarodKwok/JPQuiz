# JPQuiz Deployment Notes

> 服务器/凭据等敏感细节见 `CLAUDE.local.md`（本地文件，不入仓）。

## 生产部署架构

```
访客 → Cloudflare 边缘(:443) → cloudflared (named tunnel, outbound) → 阿里云 ECS
                                                                       └─ nginx :80 → jpquiz container 127.0.0.1:3001 → app :3000
```

- 服务器对公网**不开放任何 HTTP 端口**；HTTP 流量走 cloudflared 反向隧道
- 域名通过 Cloudflare DNS 管理，CNAME 指向 `<tunnel-id>.cfargotunnel.com`
- SSH 别名 `ali-vps`（具体连接信息见 `~/.ssh/config` 和 `CLAUDE.local.md`）

## 服务器关键路径

| 用途 | 路径 |
|---|---|
| App 部署目录 | `/opt/apps/jpquiz/`（含 `docker-compose.yml`, `Dockerfile`, `data/`, `repo/`） |
| cloudflared 凭据 | `/root/.cloudflared/cert.pem`（账号级）+ `<tunnel-id>.json`（隧道级） |
| cloudflared 配置 | `/root/.cloudflared/config.yml` |
| systemd unit | `/etc/systemd/system/cloudflared.service` |
| 日志 | `/var/log/cloudflared.log` |

## 常用运维命令

```bash
# 状态检查
ssh ali-vps "systemctl status cloudflared.service nginx --no-pager | head -30"
ssh ali-vps "docker ps"

# 重启 tunnel / 容器
ssh ali-vps "systemctl restart cloudflared.service"
ssh ali-vps "cd /opt/apps/jpquiz && docker compose restart"

# 看 tunnel 日志
ssh ali-vps "tail -50 /var/log/cloudflared.log"

# 升级 cloudflared(已配 Cloudflare apt 源)
ssh ali-vps "apt update && apt install --only-upgrade cloudflared && systemctl restart cloudflared.service"
```

## 历史变更

- **2026-05-16**: 原方案为 cloudflared **Quick Tunnel**(`*.trycloudflare.com` 临时域名,服务器重启后域名变化导致访问失效)。改造为 **Named Tunnel** + 自有子域,获得固定 URL。同时配置 Cloudflare apt 源、升级 cloudflared 至 2026.5.0。
