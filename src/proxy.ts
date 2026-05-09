import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "jpquiz-sid";

// Edge runtime — 不能访问 SQLite。这里只做 cookie 存在性检查；
// 实际 session 校验放在 route handler 内（getServerUserId）。

const PUBLIC_UI_PATHS = ["/login", "/register", "/forgot-password"];
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/audio/", "/api/cron/"];

function isPublicUI(pathname: string): boolean {
  return PUBLIC_UI_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;

  // 已登录用户访问 /login 直接跳回首页
  if (hasSession && isPublicUI(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 公开 UI 与公开 API 直接放行
  if (isPublicUI(pathname) || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  // 受保护资源
  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // 拦截除静态资源外的所有路径
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
