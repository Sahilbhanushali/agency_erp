// @ts-ignore
import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import { prisma } from "@/lib/prisma"
// @ts-ignore
import CryptoJS from "crypto-js"

import { formatReadableDate } from "./export-link"
import { fromEmailAddress, formatFrom } from "@/lib/smtp"

interface SendConfirmationEmailParams {
  clientEmail: string
  clientName: string
  projectName: string
  confirmationUrl: string
  password: string
  linkExpiresAt?: Date | string | null
  passwordExpiresAt?: Date | string | null
  companyName?: string | null
  month?: number | null
  year?: number | null
  userId?: number | null
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function buildCustomerEmailContent(params: {
  projectName: string
  clientName?: string | null
  confirmationUrl: string
  password: string
  linkExpiresAt?: Date | string | null
  passwordExpiresAt?: Date | string | null
  companyName?: string | null
  month?: number | null
  year?: number | null
}) {
  const monthYearHeading = params.month && params.year ? `${MONTH_NAMES[params.month]} ${params.year}` : ""
  const linkExpiresText = params.linkExpiresAt ? formatReadableDate(params.linkExpiresAt) : "No expiration"
  const pwdExpiresText = params.passwordExpiresAt ? formatReadableDate(params.passwordExpiresAt) : linkExpiresText
  const organizationName = params.companyName || process.env.NEXT_PUBLIC_APP_NAME || "itsmeDezino Agency"
  const emailSubject = `${params.projectName}${monthYearHeading ? ` — ${monthYearHeading}` : ""} Content Ready for Review`

  const text = `${params.projectName}\n${monthYearHeading ? `${monthYearHeading}\n` : ""}\nYour ${monthYearHeading ? `${monthYearHeading} ` : ""}content is ready for review.\n\nConfirmation Link:\n${params.confirmationUrl}\n\nPassword:\n${params.password}\n\nLink Expires:\n${linkExpiresText}\n\nPassword Expires:\n${pwdExpiresText}\n\nPlease open the confirmation link and enter the password provided above.\n\nRegards,\n${organizationName}\n`

  return { subject: emailSubject, text }
}

export async function sendConfirmationLinkEmail({
  clientEmail,
  clientName,
  projectName,
  confirmationUrl,
  password,
  linkExpiresAt,
  passwordExpiresAt,
  companyName,
  month,
  year,
  userId,
}: SendConfirmationEmailParams): Promise<{ success: boolean; message: string }> {
  try {
    if (!clientEmail || !clientEmail.includes("@")) {
      return { success: false, message: "No valid client email address provided." }
    }

    // 1. Fetch SMTP configuration (user-specific or Admin fallback)
    let smtpDetails = userId
      ? await prisma.smtpDetails.findUnique({ where: { userId } })
      : null

    if (!smtpDetails || !smtpDetails.isVerified) {
      const adminUser = await prisma.user.findFirst({
        where: { role: { name: "ADMIN" } },
      })
      if (adminUser) {
        smtpDetails = await prisma.smtpDetails.findUnique({
          where: { userId: adminUser.id },
        })
      }
    }

    // 2. Decrypt SMTP password if configured
    let transporter: Transporter | null = null

    if (smtpDetails && smtpDetails.password && smtpDetails.isVerified) {
      const encryptionKey = process.env.SMTP_PASSWORD_ENCRYPTION_KEY
      if (encryptionKey) {
        try {
          const bytes = CryptoJS.AES.decrypt(smtpDetails.password, encryptionKey)
          const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8)
          if (decryptedPassword) {
            transporter = nodemailer.createTransport({
              host: smtpDetails.host,
              port: smtpDetails.port,
              secure: smtpDetails.port === 465,
              auth: {
                user: smtpDetails.username,
                pass: decryptedPassword,
              },
            })
          }
        } catch (decryptErr) {
          console.warn("[Customer Email] Could not decrypt SMTP password:", decryptErr)
        }
      }
    }

    // 3. Fallback transporter if standard FROM_EMAIL environment is available
    if (!transporter && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    }

    if (!transporter) {
      return {
        success: false,
        message: "SMTP is not verified or configured. The password is displayed in the dashboard for manual sharing.",
      }
    }

    const monthYearHeading = month && year ? `${MONTH_NAMES[month]} ${year}` : ""
    const periodText = monthYearHeading ? ` for ${monthYearHeading}` : ""
    const linkExpiresText = linkExpiresAt ? formatReadableDate(linkExpiresAt) : "No expiration"
    const pwdExpiresText = passwordExpiresAt ? formatReadableDate(passwordExpiresAt) : linkExpiresText
    const organizationName = companyName || process.env.NEXT_PUBLIC_APP_NAME || "itsmeDezino Agency"
    const emailSubject = `${projectName}${monthYearHeading ? ` — ${monthYearHeading}` : ""} Content Ready for Review`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="background-color: #2563eb; padding: 24px 32px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Customer Confirmation Link</h1>
      <p style="margin: 6px 0 0 0; font-size: 16px; font-weight: 600;">${projectName}</p>
      ${monthYearHeading ? `<p style="margin: 2px 0 0 0; font-size: 14px; opacity: 0.9;">${monthYearHeading}</p>` : ""}
    </div>
    
    <div style="padding: 32px;">
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
        Hello <strong>${clientName}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #475569;">
        Your ${monthYearHeading ? `<strong>${monthYearHeading}</strong> ` : ""}content is ready for review. Please use the secure link and password below to access the review portal.
      </p>
      
      <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="margin-bottom: 16px;">
          <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Confirmation Link</span>
          <a href="${confirmationUrl}" style="font-size: 14px; color: #2563eb; text-decoration: underline; word-break: break-all;">
            ${confirmationUrl}
          </a>
        </div>
        
        <div style="margin-bottom: 16px;">
          <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Access Password</span>
          <span style="display: inline-block; font-family: monospace; font-size: 18px; font-weight: 700; background: #ffffff; border: 1px solid #94a3b8; border-radius: 6px; padding: 8px 16px; color: #0f172a; letter-spacing: 1px;">
            ${password}
          </span>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 12px; color: #64748b; line-height: 1.6;">
          <div><strong>Link Expires:</strong> ${linkExpiresText}</div>
          <div><strong>Password Expires:</strong> ${pwdExpiresText}</div>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${confirmationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
          Open Confirmation Link &rarr;
        </a>
      </div>

      <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0 0 16px 0;">
        Please open the confirmation link and enter the password provided above.
      </p>

      <p style="font-size: 13px; line-height: 1.5; color: #334155; margin: 0;">
        Regards,<br>
        <strong>${organizationName}</strong>
      </p>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding: 16px 32px; background-color: #f8fafc; font-size: 12px; color: #94a3b8; text-align: center;">
      This is a secure automated notification. Do not share your password with unauthorized individuals.
    </div>
  </div>
</body>
</html>
`

    const text = `${projectName}
${monthYearHeading ? `${monthYearHeading}\n` : ""}
Your ${monthYearHeading ? `${monthYearHeading} ` : ""}content is ready for review.

Confirmation Link:
${confirmationUrl}

Password:
${password}

Link Expires:
${linkExpiresText}

Password Expires:
${pwdExpiresText}

Please open the confirmation link and enter the password provided above.

Regards,
${organizationName}
`

    // The sending mailbox must be the address mail is actually authorised for, or
    // SPF/DKIM fail and the message is treated as forged. FROM_EMAIL is only used when
    // it is a real address; a display name like "itsmeDezino" is not one.
    const fromAddress = smtpDetails?.username || fromEmailAddress()
    if (!fromAddress) {
      throw new Error("No sending address configured: set SMTP_USER or FROM_EMAIL to a mailbox")
    }

    await transporter.sendMail({
      from: formatFrom(fromAddress, organizationName),
      to: clientEmail,
      subject: emailSubject,
      text,
      html,
    })

    return {
      success: true,
      message: `Email sent successfully to ${clientEmail}`,
    }
  } catch (error: any) {
    console.error("[Customer Email] Error sending email:", error)
    return {
      success: false,
      message: `Failed to send email: ${error.message}`,
    }
  }
}
