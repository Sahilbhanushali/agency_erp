import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.getOrThrow<string>('GMAIL_USER');
    const pass = this.configService.getOrThrow<string>('GMAIL_APP_PASSWORD');
    this.from = this.configService.get<string>('MAIL_FROM') ?? user;

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  async sendInviteEmail(to: string, firstName: string, acceptUrl: string) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: "You're invited to AgencyOS",
      html: `
        <p>Hi ${firstName},</p>
        <p>You've been added to AgencyOS. Set your password to activate your account:</p>
        <p><a href="${acceptUrl}">${acceptUrl}</a></p>
        <p>This link expires in 48 hours.</p>
      `,
    });
    this.logger.log(`Invite email sent to ${to}`);
  }

  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    resetUrl: string,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Reset your AgencyOS password',
      html: `
        <p>Hi ${firstName},</p>
        <p>Someone asked to reset the password for this account. If that was you, use the link below. It expires in one hour.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>If it wasn't you, you can ignore this email — your password has not changed.</p>
      `,
    });
  }
}
