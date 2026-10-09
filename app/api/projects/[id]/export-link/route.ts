import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  generateSecureToken,
  generateSecurePassword,
  hashPassword,
  verifyPassword,
  encryptPassword,
  decryptPassword,
  buildConfirmationUrl,
  calculateExpirationDate,
  calculatePasswordExpirationDate,
} from "@/lib/export-link"
import { sendConfirmationLinkEmail } from "@/lib/customer-email"
import { logAudit } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined
    const postIdsParam = searchParams.get("postIds")
    const postIdsArray = postIdsParam ? postIdsParam.split(",") : undefined

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const now = new Date()

    // Find the latest link for this project/period (prioritize ACTIVE, but return REVOKED/EXPIRED if that's the latest)
    const exportLink = await prisma.exportLink.findFirst({
      where: {
        projectId,
        ...(month && !isNaN(month) ? { month } : {}),
        ...(year && !isNaN(year) ? { year } : {}),
        ...(postIdsArray ? { postIds: { equals: postIdsArray } } : { postIds: { equals: null } }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    })

    if (!exportLink) {
      return NextResponse.json({
        link: null,
        clientEmail: project.client?.email || null,
        clientPhone: project.client?.phone || null,
        clientName: project.client?.name || project.client?.company || null,
        companyName: project.client?.company || null,
      })
    }

    const confirmationUrl = buildConfirmationUrl(
      exportLink.token,
      request.headers.get("origin") || request.nextUrl.origin
    )

    const isLinkExpired = !!(exportLink.expiresAt && exportLink.expiresAt < now)
    const isPasswordExpired = !!(exportLink.passwordExpiresAt && exportLink.passwordExpiresAt < now)

    // Never return passwordHash or encrypted ciphertext directly
    const { passwordHash, passwordEncrypted, ...safeLink } = exportLink

    // Decrypt password so authorized admin can view/copy credentials with password
    const decryptedPassword = decryptPassword(exportLink.passwordEncrypted)

    return NextResponse.json({
      link: {
        ...safeLink,
        confirmationUrl,
        password: decryptedPassword || null,
        hasPassword: !!passwordHash,
        isLinkExpired,
        isPasswordExpired,
        clientEmail: project.client?.email || null,
        clientPhone: project.client?.phone || null,
        clientName: project.client?.name || project.client?.company || null,
        companyName: project.client?.company || null,
      },
      clientEmail: project.client?.email || null,
      clientPhone: project.client?.phone || null,
      clientName: project.client?.name || project.client?.company || null,
      companyName: project.client?.company || null,
    })
  } catch (error: any) {
    console.error("[Export Link GET] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json().catch(() => ({}))
    const {
      action,
      forceNew,
      regeneratePassword,
      sendEmail,
      month,
      year,
      postIds,
      linkExpiryPreset = "30d",
      linkCustomExpiry,
      passwordExpiryPreset = "same",
      passwordCustomExpiry,
      linkId,
      password: providedPassword,
    } = body

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const now = new Date()

    // ==============================================================
    // ACTION: DEDICATED SEND EMAIL TO CLIENT
    // ==============================================================
    if (action === "SEND_EMAIL") {
      if (!project.client?.email) {
        return NextResponse.json(
          { error: "Client email address is not configured." },
          { status: 400 }
        )
      }

      const targetLink = linkId
        ? await prisma.exportLink.findFirst({
            where: {
              id: linkId,
              projectId,
            },
          })
        : await prisma.exportLink.findFirst({
            where: {
              projectId,
              status: "ACTIVE",
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            orderBy: { createdAt: "desc" },
          })

      if (!targetLink) {
        return NextResponse.json({ error: "Export link not found." }, { status: 404 })
      }

      if (targetLink.status === "REVOKED") {
        return NextResponse.json({ error: "Cannot send email for a revoked link." }, { status: 400 })
      }

      if (targetLink.expiresAt && targetLink.expiresAt < now) {
        return NextResponse.json({ error: "Cannot send email for an expired link." }, { status: 400 })
      }

      let passwordToSend = providedPassword

      // If regenerateAndSend is requested OR no plaintext password available (encrypted in DB)
      if (body.regenerateAndSend || !passwordToSend) {
        const newPassword = generateSecurePassword()
        const newHash = await hashPassword(newPassword)
        const newEncrypted = encryptPassword(newPassword)
        const newPasswordExpiresAt = calculatePasswordExpirationDate(
          passwordExpiryPreset || "same",
          targetLink.expiresAt,
          passwordCustomExpiry
        )

        const updated = await prisma.exportLink.update({
          where: { id: targetLink.id },
          data: {
            passwordHash: newHash,
            passwordEncrypted: newEncrypted,
            passwordUpdatedAt: now,
            passwordExpiresAt: newPasswordExpiresAt,
            failedAttemptCount: 0,
            lockedUntil: null,
          },
        })

        targetLink.passwordHash = newHash
        targetLink.passwordEncrypted = newEncrypted
        targetLink.passwordUpdatedAt = now
        targetLink.passwordExpiresAt = newPasswordExpiresAt
        passwordToSend = newPassword
      } else {
        if (!passwordToSend && targetLink.passwordEncrypted) {
          passwordToSend = decryptPassword(targetLink.passwordEncrypted) || ""
        }
        // Verify provided password matches stored hash before sending
        if (targetLink.passwordHash) {
          const matches = await verifyPassword(passwordToSend, targetLink.passwordHash)
          if (!matches) {
            return NextResponse.json(
              { error: "Invalid password credentials provided for sending." },
              { status: 400 }
            )
          }
        }
      }

      const confirmationUrl = buildConfirmationUrl(
        targetLink.token,
        request.headers.get("origin") || request.nextUrl.origin
      )

      const emailResult = await sendConfirmationLinkEmail({
        clientEmail: project.client.email,
        clientName: project.client.name || project.client.company || "Valued Client",
        projectName: project.name,
        confirmationUrl,
        password: passwordToSend,
        linkExpiresAt: targetLink.expiresAt,
        passwordExpiresAt: targetLink.passwordExpiresAt || targetLink.expiresAt,
        companyName: project.client.company || null,
        month: targetLink.month,
        year: targetLink.year,
        userId: session.user.id ? parseInt(session.user.id, 10) : null,
      })

      if (!emailResult.success) {
        return NextResponse.json(
          {
            error: "Unable to send email. The password has NOT been exposed or changed because of the email failure.",
            details: emailResult.message,
          },
          { status: 500 }
        )
      }

      await prisma.exportLink.update({
        where: { id: targetLink.id },
        data: { lastEmailSentAt: now },
      })

      await logAudit({
        action: "EXPORT_LINK_EMAIL_SENT",
        userId: session.user.id,
        details: `Emailed export link credentials to ${project.client.email} for project "${project.name}"`,
        metadata: { projectId, linkId: targetLink.id, clientEmail: project.client.email },
      })

      const { passwordHash: _, passwordEncrypted: __, ...safeLink } = targetLink

      return NextResponse.json({
        success: true,
        message: `Email sent successfully to ${project.client.email}`,
        link: {
          ...safeLink,
          confirmationUrl,
          password: passwordToSend, // Returned so admin UI displays the sent password!
          hasPassword: true,
          isLinkExpired: false,
          isPasswordExpired: false,
          clientEmail: project.client.email,
          clientPhone: project.client?.phone || null,
          clientName: project.client.name || project.client.company || null,
        },
      })
    }

    // ==============================================================
    // ACTION: PASSWORD REGENERATION ON EXISTING LINK
    // ==============================================================
    if (regeneratePassword) {
      const activeLink = await prisma.exportLink.findFirst({
        where: {
          projectId,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
      })

      if (!activeLink) {
        return NextResponse.json(
          { error: "No active unexpired link found to regenerate password" },
          { status: 404 }
        )
      }

      const newPassword = generateSecurePassword()
      const newHash = await hashPassword(newPassword)
      const newEncrypted = encryptPassword(newPassword)
      const newPasswordExpiresAt = calculatePasswordExpirationDate(
        passwordExpiryPreset,
        activeLink.expiresAt,
        passwordCustomExpiry
      )

      const updated = await prisma.exportLink.update({
        where: { id: activeLink.id },
        data: {
          passwordHash: newHash,
          passwordEncrypted: newEncrypted,
          passwordUpdatedAt: now,
          passwordExpiresAt: newPasswordExpiresAt,
          failedAttemptCount: 0,
          lockedUntil: null,
        },
      })

      const confirmationUrl = buildConfirmationUrl(
        updated.token,
        request.headers.get("origin") || request.nextUrl.origin
      )

      let emailResult = null
      if (sendEmail && project.client?.email) {
        emailResult = await sendConfirmationLinkEmail({
          clientEmail: project.client.email,
          clientName: project.client.name || project.client.company || "Valued Client",
          projectName: project.name,
          confirmationUrl,
          password: newPassword,
          linkExpiresAt: updated.expiresAt,
          passwordExpiresAt: updated.passwordExpiresAt,
          companyName: project.client.company || null,
          month: updated.month,
          year: updated.year,
          userId: session.user.id ? parseInt(session.user.id, 10) : null,
        })
        if (emailResult.success) {
          await prisma.exportLink.update({
            where: { id: updated.id },
            data: { lastEmailSentAt: now },
          })
        }
      }

      await logAudit({
        action: "EXPORT_LINK_PASSWORD_REGENERATED",
        userId: session.user.id,
        details: `Regenerated customer password for export link on project "${project.name}"`,
        metadata: { projectId, linkId: updated.id },
      })

      const { passwordHash: _, passwordEncrypted: __, ...safeLink } = updated

      return NextResponse.json({
        link: {
          ...safeLink,
          confirmationUrl,
          password: newPassword, // Returned to the admin UI
          hasPassword: true,
          isLinkExpired: false,
          isPasswordExpired: false,
          clientEmail: project.client?.email || null,
          clientPhone: project.client?.phone || null,
          clientName: project.client?.name || project.client?.company || null,
          companyName: project.client?.company || null,
        },
        passwordRegenerated: true,
        emailResult,
      })
    }

    // ==============================================================
    // ACTION: REUSE EXISTING ACTIVE UNEXPIRED LINK IF NOT forceNew
    // ==============================================================
    if (!forceNew) {
      const existingLink = await prisma.exportLink.findFirst({
        where: {
          projectId,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          ...(month && !isNaN(month) ? { month: Number(month) } : {}),
          ...(year && !isNaN(year) ? { year: Number(year) } : {}),
          ...(Array.isArray(postIds) ? { postIds: { equals: postIds } } : { postIds: { equals: null } }),
        },
        orderBy: { createdAt: "desc" },
      })

      if (existingLink) {
        let plaintextPassword: string | null = null
        let updatedLink = existingLink

        // If existing link has encrypted password, decrypt it
        if (existingLink.passwordEncrypted) {
          plaintextPassword = decryptPassword(existingLink.passwordEncrypted)
        }

        // If existing link had no password or no encrypted password yet, generate one now
        if (!plaintextPassword || !existingLink.passwordHash) {
          plaintextPassword = generateSecurePassword()
          const pHash = await hashPassword(plaintextPassword)
          const pEncrypted = encryptPassword(plaintextPassword)
          const pExpiresAt = calculatePasswordExpirationDate(
            passwordExpiryPreset,
            existingLink.expiresAt,
            passwordCustomExpiry
          )
          updatedLink = await prisma.exportLink.update({
            where: { id: existingLink.id },
            data: {
              passwordHash: pHash,
              passwordEncrypted: pEncrypted,
              passwordUpdatedAt: now,
              passwordExpiresAt: pExpiresAt,
            },
          })
        }

        const confirmationUrl = buildConfirmationUrl(
          updatedLink.token,
          request.headers.get("origin") || request.nextUrl.origin
        )

        let emailResult = null
        if (sendEmail && plaintextPassword && project.client?.email) {
          emailResult = await sendConfirmationLinkEmail({
            clientEmail: project.client.email,
            clientName: project.client.name || project.client.company || "Valued Client",
            projectName: project.name,
            confirmationUrl,
            password: plaintextPassword,
            linkExpiresAt: updatedLink.expiresAt,
            passwordExpiresAt: updatedLink.passwordExpiresAt,
            companyName: project.client.company || null,
            month: updatedLink.month,
            year: updatedLink.year,
            userId: session.user.id ? parseInt(session.user.id, 10) : null,
          })
          if (emailResult.success) {
            await prisma.exportLink.update({
              where: { id: updatedLink.id },
              data: { lastEmailSentAt: now },
            })
          }
        }

        const { passwordHash: _, passwordEncrypted: __, ...safeLink } = updatedLink
        const isLinkExpired = !!(updatedLink.expiresAt && updatedLink.expiresAt < now)
        const isPasswordExpired = !!(updatedLink.passwordExpiresAt && updatedLink.passwordExpiresAt < now)

        return NextResponse.json({
          link: {
            ...safeLink,
            confirmationUrl,
            password: plaintextPassword, // Null if previously created, string if freshly generated
            hasPassword: true,
            isLinkExpired,
            isPasswordExpired,
            clientEmail: project.client?.email || null,
            clientPhone: project.client?.phone || null,
            clientName: project.client?.name || project.client?.company || null,
            companyName: project.client?.company || null,
          },
          reused: true,
          emailResult,
        })
      }
    }

    // ==============================================================
    // ACTION: CREATE FRESH LINK WITH EXPLICIT EXPIRATIONS
    // ==============================================================
    if (forceNew) {
      await prisma.exportLink.updateMany({
        where: {
          projectId,
          status: "ACTIVE",
          ...(month && !isNaN(month) ? { month: Number(month) } : {}),
          ...(year && !isNaN(year) ? { year: Number(year) } : {}),
          ...(Array.isArray(postIds) ? { postIds: { equals: postIds } } : { postIds: { equals: null } }),
        },
        data: {
          status: "REVOKED",
          revokedAt: now,
        },
      })
    }

    const token = generateSecureToken()
    const password = generateSecurePassword()
    const pHash = await hashPassword(password)
    const pEncrypted = encryptPassword(password)

    // Calculate explicit Link Expiration and Password Expiration
    const expiresAt = calculateExpirationDate(linkExpiryPreset, linkCustomExpiry, 30)
    const passwordExpiresAt = calculatePasswordExpirationDate(
      passwordExpiryPreset,
      expiresAt,
      passwordCustomExpiry
    )

    const newLink = await prisma.exportLink.create({
      data: {
        token,
        projectId,
        clientId: project.clientId || null,
        createdById: session.user.id ? parseInt(session.user.id, 10) : null,
        month: month && !isNaN(month) ? Number(month) : null,
        year: year && !isNaN(year) ? Number(year) : null,
        postIds: Array.isArray(postIds) ? postIds : null,
        status: "ACTIVE",
        passwordHash: pHash,
        passwordEncrypted: pEncrypted,
        passwordUpdatedAt: now,
        passwordExpiresAt,
        expiresAt,
      },
    })

    const confirmationUrl = buildConfirmationUrl(
      newLink.token,
      request.headers.get("origin") || request.nextUrl.origin
    )

    let emailResult = null
    if (sendEmail && project.client?.email) {
      emailResult = await sendConfirmationLinkEmail({
        clientEmail: project.client.email,
        clientName: project.client.name || project.client.company || "Valued Client",
        projectName: project.name,
        confirmationUrl,
        password,
        linkExpiresAt: newLink.expiresAt,
        passwordExpiresAt: newLink.passwordExpiresAt,
        companyName: project.client.company || null,
        month: newLink.month,
        year: newLink.year,
        userId: session.user.id ? parseInt(session.user.id, 10) : null,
      })
      if (emailResult.success) {
        await prisma.exportLink.update({
          where: { id: newLink.id },
          data: { lastEmailSentAt: now },
        })
      }
    }

    await logAudit({
      action: "EXPORT_LINK_CREATED",
      userId: session.user.id,
      details: `Created export link for project "${project.name}" (Expires: ${expiresAt.toISOString()})`,
      metadata: {
        projectId,
        linkId: newLink.id,
        expiresAt: expiresAt.toISOString(),
        passwordExpiresAt: passwordExpiresAt ? passwordExpiresAt.toISOString() : null,
        month,
        year,
      },
    })

    const { passwordHash: _, passwordEncrypted: __, ...safeLink } = newLink

    return NextResponse.json(
      {
        link: {
          ...safeLink,
          confirmationUrl,
          password, // Sent ONCE to the admin dialog memory
          hasPassword: true,
          isLinkExpired: false,
          isPasswordExpired: false,
          clientEmail: project.client?.email || null,
          clientPhone: project.client?.phone || null,
          clientName: project.client?.name || project.client?.company || null,
          companyName: project.client?.company || null,
        },
        reused: false,
        emailResult,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[Export Link POST] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get("linkId")

    const now = new Date()

    if (linkId) {
      await prisma.exportLink.update({
        where: { id: linkId },
        data: {
          status: "REVOKED",
          revokedAt: now,
        },
      })
    } else {
      await prisma.exportLink.updateMany({
        where: {
          projectId,
          status: "ACTIVE",
        },
        data: {
          status: "REVOKED",
          revokedAt: now,
        },
      })
    }

    await logAudit({
      action: "EXPORT_LINK_REVOKED",
      userId: session.user.id,
      details: `Revoked customer confirmation export link for project ID ${projectId}`,
      metadata: { projectId, linkId },
    })

    return NextResponse.json({ success: true, message: "Export link revoked" })
  } catch (error: any) {
    console.error("[Export Link DELETE] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
