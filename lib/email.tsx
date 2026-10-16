import { resolveSmtp } from "@/lib/smtp"

/**
 * Transactional emails. Every sender resolves SMTP through lib/smtp.ts, which decrypts
 * the stored password and throws when nothing is configured — the previous version
 * passed the ciphertext to nodemailer and fell back to credentials hardcoded here, so
 * invitations silently went nowhere.
 */
async function getTransporter() {
  const { transporter, fromEmail } = await resolveSmtp()
  return { transporter, fromEmail }
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`

  const { transporter, fromEmail } = await getTransporter()

  const mailOptions = {
    from: fromEmail,
    to: email,
    subject: "Reset your password — Agency ERP",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">Password Reset Request</h2>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin: 0;">You requested a password reset for your Agency ERP account. Click the button below to choose a new password:</p>
        </div>
        <div style="margin: 28px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Reset Password</a>
        </div>
        <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin: 0 0 8px 0;">This link will expire in 1 hour.</p>
        <p style="font-size: 12px; color: #9ca3af; margin: 0 0 20px 0;">If you did not request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 20px 0;" />
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">Agency Operating System • Automated notification</p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}

export async function sendOnboardingInviteEmail(params: {
  email: string
  name: string
  role: string
  token: string
}) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const setupUrl = `${baseUrl}/auth/setup-password?token=${params.token}`

  const { transporter, fromEmail } = await getTransporter()

  const mailOptions = {
    from: fromEmail,
    to: params.email,
    subject: `You've been invited to join Agency ERP as ${params.role}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #111827;">
        <div style="margin-bottom: 24px;">
          <div style="display: inline-block; padding: 4px 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 16px;">
            Agency Workspace Invitation
          </div>
          <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 10px 0;">
            Welcome to the team, ${params.name}!
          </h1>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0;">
            Your account has been created on the agency management platform with the role of <strong>${params.role}</strong>. Please set up your password to activate your access and get started.
          </p>
        </div>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #6b7280; padding: 4px 0; width: 120px;">Email / Login:</td>
              <td style="color: #111827; font-weight: 600; font-family: monospace; padding: 4px 0;">${params.email}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; padding: 4px 0;">Assigned Role:</td>
              <td style="color: #111827; font-weight: 600; padding: 4px 0;">${params.role}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 28px 0; text-align: left;">
          <a href="${setupUrl}" style="display: inline-block; padding: 14px 28px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px;">
            Set Up Your Password &rarr;
          </a>
        </div>

        <p style="font-size: 12px; color: #6b7280; line-height: 1.5; margin: 16px 0 8px 0;">
          This link will expire in <strong>48 hours</strong>. After setting your password, you will be automatically logged in to your agency dashboard.
        </p>

        <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin: 0 0 24px 0; word-break: break-all;">
          If the button doesn't work, copy and paste this URL into your browser:<br />
          <a href="${setupUrl}" style="color: #2563eb; text-decoration: underline;">${setupUrl}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">
          Agency Management Platform • Confidential &bull; If you received this by mistake, please disregard.
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}

export async function sendWelcomeEmail(email: string, name: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const { transporter, fromEmail } = await getTransporter()

  const mailOptions = {
    from: fromEmail,
    to: email,
    subject: "Welcome to Agency ERP",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
        <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">Welcome, ${name}!</h2>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin: 0 0 20px 0;">Your account has been activated. You can now log in and access your workspace.</p>
        <a href="${baseUrl}/auth/signin" style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Sign In</a>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}
