import { NextResponse } from "next/server";
import { getBoards } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET() {
  const boards = await getBoards();
  return NextResponse.json({
    ...boards,
    updatedAt: new Date().toISOString(),
  });
}
