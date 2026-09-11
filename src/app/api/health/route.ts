import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "VibeDoc Web & Bot Host",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
