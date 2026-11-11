import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { services } from "@/db/schema";
import { ensureDemoData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDemoData();
    const result = await db.select().from(services).where(eq(services.isActive, true)).orderBy(asc(services.name));
    return NextResponse.json({ services: result.map(({ createdAt: _createdAt, ...service }) => service) });
  } catch (error) {
    console.error("Service catalog error", error);
    return NextResponse.json({ error: "Katalog layanan belum dapat dimuat." }, { status: 500 });
  }
}
