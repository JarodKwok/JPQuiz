import { NextRequest, NextResponse } from "next/server";
import { ForbiddenError, getServerUserId, UnauthorizedError } from "@/lib/db/server-user";

type HandlerFn = (
  req: NextRequest,
  ownerId: string,
  body: Record<string, unknown>
) => unknown | Promise<unknown>;

type HandlerMap = Record<string, HandlerFn>;

// Lazy-loaded handler registries (populated by each repo module)
let _handlers: HandlerMap | null = null;

async function loadHandlers(): Promise<HandlerMap> {
  if (_handlers) return _handlers;

  const modules = await Promise.all([
    import("@/lib/db/repos/log-repo"),
    import("@/lib/db/repos/account-repo"),
    import("@/lib/db/repos/mastery-repo"),
    import("@/lib/db/repos/wrong-answers-repo"),
    import("@/lib/db/repos/progress-repo"),
    import("@/lib/db/repos/quiz-repo"),
    import("@/lib/db/repos/ai-repo"),
    import("@/lib/db/repos/admin-repo"),
    import("@/lib/db/repos/migration-repo"),
  ]);

  _handlers = {};
  for (const mod of modules) {
    if (mod.handlers) {
      Object.assign(_handlers, mod.handlers);
    }
  }
  return _handlers;
}

function resolveAction(params: { action: string[] }): string {
  return params.action.join("/");
}

async function handleRequest(
  req: NextRequest,
  params: Promise<{ action: string[] }>
): Promise<NextResponse> {
  try {
    const { action } = await params;
    const actionPath = resolveAction({ action });
    const handlers = await loadHandlers();
    const handler = handlers[actionPath];

    if (!handler) {
      return NextResponse.json(
        { error: `Unknown action: ${actionPath}` },
        { status: 404 }
      );
    }

    let ownerId: string;
    try {
      ownerId = await getServerUserId();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }
      throw e;
    }
    let body: Record<string, unknown> = {};

    if (req.method === "POST" || req.method === "PUT") {
      try {
        body = await req.json();
      } catch {
        // empty body is OK for some endpoints
      }
    }

    const result = await handler(req, ownerId, body);
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[api/db] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> }
) {
  return handleRequest(req, ctx.params);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> }
) {
  return handleRequest(req, ctx.params);
}
