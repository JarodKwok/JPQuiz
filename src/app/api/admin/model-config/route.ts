import { NextRequest, NextResponse } from "next/server";
import {
  getAdminModelConfig,
  maskApiKey,
  upsertAdminModelConfig,
} from "@/lib/db/repos/admin-config-repo";
import {
  ForbiddenError,
  requireAdminUserId,
  UnauthorizedError,
} from "@/lib/db/server-user";

function authError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  try {
    await requireAdminUserId();
  } catch (err) {
    const e = authError(err);
    if (e) return e;
    throw err;
  }

  const cfg = getAdminModelConfig();
  if (!cfg) return NextResponse.json({ config: null });

  return NextResponse.json({
    config: {
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      apiKeyMasked: maskApiKey(cfg.apiKey),
      hasApiKey: !!cfg.apiKey,
      model: cfg.model,
      wireApi: cfg.wireApi,
      reasoningEffort: cfg.reasoningEffort,
      updatedAt: cfg.updatedAt,
      updatedBy: cfg.updatedBy,
    },
  });
}

export async function PUT(req: NextRequest) {
  let adminId: string;
  try {
    adminId = await requireAdminUserId();
  } catch (err) {
    const e = authError(err);
    if (e) return e;
    throw err;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const wireApi = body.wireApi === "responses" ? "responses" : "chat";
  const reasoningEffort =
    typeof body.reasoningEffort === "string" && body.reasoningEffort.trim()
      ? body.reasoningEffort.trim()
      : null;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;

  if (!provider || !baseUrl || !model) {
    return NextResponse.json(
      { error: "provider, baseUrl, model are required" },
      { status: 400 }
    );
  }

  try {
    const saved = upsertAdminModelConfig({
      provider,
      baseUrl,
      apiKey,
      model,
      wireApi,
      reasoningEffort,
      updatedBy: adminId,
    });
    return NextResponse.json({
      ok: true,
      config: {
        provider: saved.provider,
        baseUrl: saved.baseUrl,
        apiKeyMasked: maskApiKey(saved.apiKey),
        hasApiKey: true,
        model: saved.model,
        wireApi: saved.wireApi,
        reasoningEffort: saved.reasoningEffort,
        updatedAt: saved.updatedAt,
        updatedBy: saved.updatedBy,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 400 }
    );
  }
}
