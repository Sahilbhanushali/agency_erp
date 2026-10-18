import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { can } from "@/lib/api-auth"

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !(await can(session, "utilities", "update"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { values } = await request.json()
    const { id } = params

    const utility = await prisma.utility.update({
      where: { id },
      data: {
        values,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(utility)
  } catch (error) {
    console.error("Failed to update utility:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !(await can(session, "utilities", "delete"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    await prisma.utility.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete utility:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
