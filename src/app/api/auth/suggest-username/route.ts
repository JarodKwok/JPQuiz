import { NextResponse } from "next/server";
import { suggestUsername } from "@/lib/db/repos/auth-repo";

export async function GET() {
  return NextResponse.json({ username: suggestUsername() });
}
