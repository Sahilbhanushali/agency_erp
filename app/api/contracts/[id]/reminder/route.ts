import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/api-auth";
import { logAuditAction } from "@/lib/audit";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCan("contracts", "create");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: true,
        project: { select: { name: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (!contract.client?.email) {
      return NextResponse.json(
        { error: "Client does not have an active email address registered" },
        { status: 400 }
      );
    }

    // Determine days until renewal
    const targetDate = contract.renewalDate || contract.endDate;
    const daysLeft = targetDate
      ? Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 3600 * 24))
      : 30;

    const renewalDateFormatted = targetDate
      ? new Date(targetDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Upcoming";

    // SMTP configuration
    let transporter: any;
    let fromEmail = process.env.FROM_EMAIL || "pbind4545@gmail.com";

    const adminSmtp = await prisma.smtpDetails.findFirst({
      where: { isActive: true, isVerified: true },
    });

    if (adminSmtp) {
      transporter = nodemailer.createTransport({
        host: adminSmtp.host,
        port: adminSmtp.port,
        secure: adminSmtp.encryption === "SSL",
        auth: { user: adminSmtp.username, pass: adminSmtp.password },
        tls: adminSmtp.encryption === "TLS" ? { ciphers: "SSLv3" } : undefined,
      });
      fromEmail = adminSmtp.username;
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "pbind4545@gmail.com",
          pass: process.env.SMTP_PASSWORD || "eptg xytk wsxe waet",
        },
      });
    }

    const mailOptions = {
      from: fromEmail,
      to: contract.client.email,
      subject: `Upcoming Retainer Renewal Reminder — ${contract.title}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #111827;">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-block; padding: 4px 10px; background-color: #fef3c7; color: #92400e; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
              Notice of Contract Renewal
            </div>
            <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 10px 0;">
              Retainer Renewal Notice: ${contract.title}
            </h1>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0;">
              Dear ${contract.client.name},<br />
              This is a friendly reminder that your agency service agreement is scheduled for renewal on <strong>${renewalDateFormatted}</strong> (${daysLeft > 0 ? `${daysLeft} days remaining` : "renewal due"}).
            </p>
          </div>

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #6b7280; padding: 5px 0; width: 140px;">Contract Reference:</td>
                <td style="color: #111827; font-weight: 600; font-family: monospace; padding: 5px 0;">${contract.contractNumber || contract.id}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Agreement Type:</td>
                <td style="color: #111827; font-weight: 600; padding: 5px 0;">${contract.type}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Billing Cycle:</td>
                <td style="color: #111827; font-weight: 600; padding: 5px 0;">${contract.billingCycle}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Retainer Fee:</td>
                <td style="color: #111827; font-weight: 600; font-family: monospace; padding: 5px 0;">₹${Number(contract.value).toLocaleString("en-IN")} ${contract.currency}</td>
              </tr>
              ${
                contract.retainerHours
                  ? `<tr>
                      <td style="color: #6b7280; padding: 5px 0;">Allocated Capacity:</td>
                      <td style="color: #111827; font-weight: 600; padding: 5px 0;">${contract.retainerHours} Hours / cycle</td>
                    </tr>`
                  : ""
              }
              <tr>
                <td style="color: #6b7280; padding: 5px 0;">Renewal Date:</td>
                <td style="color: #111827; font-weight: 600; padding: 5px 0;">${renewalDateFormatted}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
            We look forward to continuing our partnership. If you wish to make any changes to your deliverable scope, retainer hours, or agreement terms, please reach out to your Account Manager.
          </p>

          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
          <p style="font-size: 11px; color: #9ca3af; margin: 0;">
            Agency Operations Team • Automated contract governance notification
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    await prisma.contract.update({
      where: { id },
      data: {
        reminderSent: true,
        lastReminderAt: new Date(),
        status: contract.status === "ACTIVE" && daysLeft <= 30 ? "EXPIRING_SOON" : contract.status,
      },
    });

    await logAuditAction({
      userId: String(auth.userId),
      action: "UPDATE",
      entityType: "Contract",
      entityId: id,
      newValues: JSON.stringify({
        action: "renewal_reminder_dispatched",
        recipient: contract.client.email,
        daysLeft,
      }),
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      success: true,
      message: `Renewal notice successfully sent to ${contract.client.email}`,
    });
  } catch (error: any) {
    console.error("[contracts] reminder failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to dispatch renewal reminder" },
      { status: 500 }
    );
  }
}
