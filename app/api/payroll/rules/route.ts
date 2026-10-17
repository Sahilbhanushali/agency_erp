import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PayrollService } from "@/lib/payroll/payroll-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country") || "IN";
    const state = searchParams.get("state") || "ALL";

    const settings = await PayrollService.getSettings();
    const statutory = await PayrollService.getStatutoryConfig(country, state);

    // Also get all state-level statutory rules
    const allStatutoryConfigs = await prisma.statutoryConfig.findMany({
      orderBy: [{ state: "asc" }, { effectiveFrom: "desc" }],
    });

    return NextResponse.json({
      settings,
      statutory,
      allStatutoryConfigs,
    });
  } catch (error: any) {
    console.error("GET /api/payroll/rules error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch calculation rules" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "";
    if (!["ADMIN", "HR", "FINANCE"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: HR/Admin/Finance required" }, { status: 403 });
    }

    const body = await request.json();

    // 1. Update general payroll settings
    let updatedSettings = null;
    if (body.settings) {
      updatedSettings = await PayrollService.updateSettings(body.settings);
    }

    // 2. Update statutory calculation rules if provided
    let updatedStatutory = null;
    if (body.statutory) {
      const s = body.statutory;
      const country = s.country || "IN";
      const state = s.state || "ALL";

      // If active record exists, update it or create new effective version
      const existing = await prisma.statutoryConfig.findFirst({
        where: { country, state, effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      });

      const ptSlabsJson = s.ptSlabs ? JSON.stringify(s.ptSlabs) : existing ? existing.ptSlabsJson : JSON.stringify([]);

      if (existing) {
        updatedStatutory = await prisma.statutoryConfig.update({
          where: { id: existing.id },
          data: {
            pfEmployeeRate: s.pfEmployeeRate !== undefined ? Number(s.pfEmployeeRate) : existing.pfEmployeeRate,
            pfEmployerEpfRate: s.pfEmployerEpfRate !== undefined ? Number(s.pfEmployerEpfRate) : existing.pfEmployerEpfRate,
            pfEmployerEpsRate: s.pfEmployerEpsRate !== undefined ? Number(s.pfEmployerEpsRate) : existing.pfEmployerEpsRate,
            pfEmployerEdliRate: s.pfEmployerEdliRate !== undefined ? Number(s.pfEmployerEdliRate) : existing.pfEmployerEdliRate,
            pfAdminChargesRate: s.pfAdminChargesRate !== undefined ? Number(s.pfAdminChargesRate) : existing.pfAdminChargesRate,
            pfWageCeiling: s.pfWageCeiling !== undefined ? Math.round(Number(s.pfWageCeiling)) : existing.pfWageCeiling,
            esiEmployeeRate: s.esiEmployeeRate !== undefined ? Number(s.esiEmployeeRate) : existing.esiEmployeeRate,
            esiEmployerRate: s.esiEmployerRate !== undefined ? Number(s.esiEmployerRate) : existing.esiEmployerRate,
            esiWageCeiling: s.esiWageCeiling !== undefined ? Math.round(Number(s.esiWageCeiling)) : existing.esiWageCeiling,
            ptSlabsJson,
          },
        });
      } else {
        updatedStatutory = await prisma.statutoryConfig.create({
          data: {
            country,
            state,
            effectiveFrom: new Date(),
            pfEmployeeRate: s.pfEmployeeRate !== undefined ? Number(s.pfEmployeeRate) : 12.0,
            pfEmployerEpfRate: s.pfEmployerEpfRate !== undefined ? Number(s.pfEmployerEpfRate) : 3.67,
            pfEmployerEpsRate: s.pfEmployerEpsRate !== undefined ? Number(s.pfEmployerEpsRate) : 8.33,
            pfEmployerEdliRate: s.pfEmployerEdliRate !== undefined ? Number(s.pfEmployerEdliRate) : 0.5,
            pfAdminChargesRate: s.pfAdminChargesRate !== undefined ? Number(s.pfAdminChargesRate) : 0.5,
            pfWageCeiling: s.pfWageCeiling !== undefined ? Math.round(Number(s.pfWageCeiling)) : 1500000,
            esiEmployeeRate: s.esiEmployeeRate !== undefined ? Number(s.esiEmployeeRate) : 0.75,
            esiEmployerRate: s.esiEmployerRate !== undefined ? Number(s.esiEmployerRate) : 3.25,
            esiWageCeiling: s.esiWageCeiling !== undefined ? Math.round(Number(s.esiWageCeiling)) : 2100000,
            ptSlabsJson,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
      statutory: updatedStatutory,
    });
  } catch (error: any) {
    console.error("PUT /api/payroll/rules error:", error);
    return NextResponse.json({ error: error.message || "Failed to update calculation rules" }, { status: 500 });
  }
}

// POST endpoint for real-time calculation simulation or reset
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "simulate") {
      const body = await request.json();
      const testGross = Number(body.gross || 50000);
      const testBasic = Number(body.basic || testGross * 0.5);
      const isPf = body.pf !== undefined ? Boolean(body.pf) : true;
      const isEsi = body.esi !== undefined ? Boolean(body.esi) : false;
      const isPt = body.pt !== undefined ? Boolean(body.pt) : true;

      const statutory = await PayrollService.getStatutoryConfig(body.country || "IN", body.state || "ALL");

      // Calculation simulation
      let pfEmployee = 0;
      let pfEmployer = 0;
      if (isPf) {
        const eligibleWage = Math.min(testBasic * 100, statutory.pfWageCeiling);
        pfEmployee = Math.round(eligibleWage * (statutory.pfEmployeeRate / 100));
        pfEmployer = Math.round(eligibleWage * ((statutory.pfEmployerEpfRate + statutory.pfEmployerEpsRate) / 100));
      }

      let esiEmployee = 0;
      let esiEmployer = 0;
      if (isEsi && testGross * 100 <= statutory.esiWageCeiling) {
        esiEmployee = Math.round(testGross * 100 * (statutory.esiEmployeeRate / 100));
        esiEmployer = Math.round(testGross * 100 * (statutory.esiEmployerRate / 100));
      }

      let ptAmount = 0;
      if (isPt && statutory.ptSlabs?.length) {
        for (const slab of statutory.ptSlabs) {
          if (testGross * 100 >= slab.min && (slab.max === null || slab.max === 0 || testGross * 100 <= slab.max)) {
            ptAmount = slab.amount;
            break;
          }
        }
      }

      const totalDeductions = pfEmployee + esiEmployee + ptAmount;
      const netPay = (testGross * 100) - totalDeductions;

      return NextResponse.json({
        simulated: true,
        grossPaise: testGross * 100,
        basicPaise: testBasic * 100,
        pfEmployeePaise: pfEmployee,
        pfEmployerPaise: pfEmployer,
        esiEmployeePaise: esiEmployee,
        esiEmployerPaise: esiEmployer,
        ptPaise: ptAmount,
        totalDeductionsPaise: totalDeductions,
        netPayPaise: netPay,
      });
    }

    if (action === "reset") {
      const userRole = (session.user as any).role || "";
      if (!["ADMIN", "HR"].includes(userRole)) {
        return NextResponse.json({ error: "Forbidden: Admin required to reset rules" }, { status: 403 });
      }

      // Reset to statutory defaults
      await prisma.statutoryConfig.deleteMany({ where: { country: "IN", state: "ALL" } });
      await prisma.payrollSettings.deleteMany({ where: { id: "default" } });
      const freshSettings = await PayrollService.getSettings();
      const freshStatutory = await PayrollService.getStatutoryConfig();

      return NextResponse.json({
        success: true,
        message: "Calculation rules reset to statutory government defaults",
        settings: freshSettings,
        statutory: freshStatutory,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/payroll/rules error:", error);
    return NextResponse.json({ error: error.message || "Failed to process rule action" }, { status: 500 });
  }
}
