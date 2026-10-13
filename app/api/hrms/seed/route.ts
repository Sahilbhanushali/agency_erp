import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { seedHrmsInitialData } from "@/lib/hrms/seed-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    await seedHrmsInitialData();
    return NextResponse.json({ success: true, message: "HRMS demo data initialized successfully." });
  } catch (error: any) {
    console.error("HRMS seed error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize HRMS data" },
      { status: 500 }
    );
  }
}
