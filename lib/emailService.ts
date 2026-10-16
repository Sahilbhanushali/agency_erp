import nodemailer, { Transporter } from 'nodemailer';
import {prisma} from '@/lib/prisma';
import { decryptSmtpPassword } from '@/lib/smtp';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function createEmailService(userId: number) {
  let transporter: Transporter | null = null;

  return {
    async initialize() {
      try {
        // Fetch SMTP details from the database
        let smtpDetails = await prisma.smtpDetails.findUnique({
          where: { userId },
          select: {
            host: true,
            port: true,
            username: true,
            password: true,
            encryption: true,
          },
        });

        if (!smtpDetails) {
          console.log(`No SMTP details found for userId: ${userId}, falling back to ADMIN's SMTP details`);
          const adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
          });
          
          if (adminUser) {
            smtpDetails = await prisma.smtpDetails.findUnique({
              where: { userId: adminUser.id },
              select: {
                host: true,
                port: true,
                username: true,
                password: true,
                encryption: true,
              },
            });
          }
        }

        if (!smtpDetails) {
          throw new Error(`No SMTP details found for userId: ${userId} and no ADMIN SMTP details available.`);
        }

        const { host, port, username, password, encryption } = smtpDetails;

        // Validate SMTP details
        if (!host || !port || !username || !password) {
          throw new Error('Incomplete SMTP details: host, port, username, and password are required');
        }

        // The stored password is encrypted at rest; handing the ciphertext to
        // nodemailer is why every send failed authentication.
        const plainPassword = decryptSmtpPassword(password);

        // `secure` means implicit TLS on connect, which is port 465 only. Setting it
        // for STARTTLS on 587 — as this did for encryption === 'TLS' — makes the
        // handshake hang rather than upgrade.
        transporter = nodemailer.createTransport({
          host,
          port,
          secure: encryption === 'SSL' || port === 465,
          auth: {
            user: username,
            pass: plainPassword,
          },
          ...(encryption === 'TLS' ? { requireTLS: true } : {}),
        });

        // Verify SMTP connection
        await transporter!.verify();
        console.log(`SMTP connection verified for userId: ${userId}`);

        // Log initialization in auditLog
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'EMAIL_SERVICE_INITIALIZED',
            entityType: 'EMAIL',
            newValues: { host, port, username, encryption },
          },
        });
      } catch (error: any) {
        console.error('Failed to initialize EmailService:', {
          userId,
          error: error.message,
          stack: error.stack,
        });
        throw new Error(`EmailService initialization failed: ${error.message}`);
      }
    },

    async sendEmail(options: EmailOptions) {
      if (!transporter) {
        throw new Error('EmailService not initialized. Call initialize() first.');
      }

      try {
        const { to, subject, html, text } = options;

        // Validate email options
        if (!to || !subject || !html || !text) {
          throw new Error('Invalid email options: to, subject, html, and text are required');
        }

        const fromEmail = (transporter!.options as any).auth?.user || 'default@example.com';
        const info = await transporter!.sendMail({
          from: `"Your App" <${fromEmail}>`,
          to,
          subject,
          html,
          text,
        });

        // Log email sending in auditLog
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'EMAIL_SENT',
            entityType: 'EMAIL',
            newValues: { to, subject, messageId: info.messageId },
          },
        });

        return info;
      } catch (error: any) {
        console.error('Failed to send email:', {
          userId,
          to: options.to,
          subject: options.subject,
          error: error.message,
          stack: error.stack,
        });
        throw new Error(`Failed to send email: ${error.message}`);
      }
    },
  };
}