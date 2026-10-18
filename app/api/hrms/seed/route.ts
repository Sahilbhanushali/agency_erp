import { type NextRequest, NextResponse } from "next/server";
import { can, requireCan, requireSession } from "@/lib/api-auth";
import { seedHrmsInitialData } from "@/lib/hrms/seed-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireCan("settings", "update");
  if (!auth.ok) return auth.response;

  if (!(await can(auth.session, "hrms", "create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
