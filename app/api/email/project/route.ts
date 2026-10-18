import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CryptoJS from 'crypto-js';
import { requireCan } from "@/lib/api-auth";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const auth = await requireCan("projects", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const { projectId, assignedUserId } = await request.json();

    console.log('📧 Email API received:', { projectId, assignedUserId, projectIdType: typeof projectId });

    if (!projectId || !assignedUserId) {
      return NextResponse.json({ error: 'Project ID and assigned user ID are required' }, { status: 400 });
    }

    // Handle both string (cuid) and numeric project IDs
    const validProjectId = projectId; // Keep as-is since Prisma can handle both
    console.log('✅ Using projectId:', validProjectId);

    // Fetch assigned user's email and name
    const assignedUser = await prisma.user.findUnique({
      where: { id: parseInt(assignedUserId) },
      select: { email: true, name: true },
    });

    if (!assignedUser) {
      console.error(`Assigned user not found for ID: ${assignedUserId}`);
      return NextResponse.json({ error: 'Assigned user not found' }, { status: 400 });
    }

    // Fetch project details - this will work with both string and numeric IDs
    const project = await prisma.project.findUnique({
      where: { id: validProjectId }, // Prisma handles both string cuids and numeric IDs
      select: { 
        name: true, 
        description: true, 
        startDate: true, 
        endDate: true, 
        clientId: true,
        managerId: true,
        postTypes: true,
      },
    });

    if (!project) {
      console.error(`Project not found for ID: ${validProjectId}`);
      return NextResponse.json({ error: 'Project not found' }, { status: 400 });
    }

    console.log('✅ Found project:', { name: project.name, id: validProjectId });

    // Fetch client name
    const client = project.clientId
      ? await prisma.client.findUnique({
          where: { id: project.clientId },
          select: { name: true },
        })
      : null;

    // Fetch manager name if managerId exists
    const manager = project.managerId
      ? await prisma.user.findUnique({
          where: { id: project.managerId },
          select: { name: true, email: true },
        })
      : null;

    // Fetch SMTP details for the session user
    let smtpDetails = await prisma.smtpDetails.findUnique({
      where: { userId: parseInt(session.user.id) }, // Use session user ID in production
      select: { host: true, port: true, username: true, password: true, encryption: true, isVerified: true },
    });

    // Fallback to any verified SMTP config if current manager does not have one
    if (!smtpDetails || !smtpDetails.isVerified) {
      console.warn(`SMTP details missing or unverified for user ID: ${session.user.id}. Falling back to a verified SMTP account.`);
      smtpDetails = await prisma.smtpDetails.findFirst({
        where: { isVerified: true },
        orderBy: { updatedAt: 'desc' },
        select: { host: true, port: true, username: true, password: true, encryption: true, isVerified: true },
      });
    }

    if (!smtpDetails) {
      console.error(`No verified SMTP details found for any user`);
      return NextResponse.json({ error: 'No verified SMTP configuration available to send the email' }, { status: 500 });
    }

    if (!smtpDetails.isVerified) {
      console.error(`Fallback SMTP configuration is not verified`);
      return NextResponse.json({ error: 'Fallback SMTP configuration is not verified' }, { status: 500 });
    }

    // Log SMTP configuration (exclude password)
    console.log('SMTP configuration selected for email:', {
      host: smtpDetails.host,
      port: smtpDetails.port,
      username: smtpDetails.username,
      encryption: smtpDetails.encryption,
      isVerified: smtpDetails.isVerified,
    });

    const encryptionKey = process.env.SMTP_PASSWORD_ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error('SMTP password encryption key not found in environment variables');
      return NextResponse.json({ error: 'SMTP password encryption key not configured' }, { status: 500 });
    }

    let decryptedPassword: string;
    try {
      const bytes = CryptoJS.AES.decrypt(smtpDetails.password, encryptionKey);
      decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedPassword) {
        throw new Error('Decryption failed: Invalid key or corrupted data');
      }
    } catch (decryptError: any) {
      console.error('Failed to decrypt SMTP password:', decryptError.message);
      return NextResponse.json(
        { error: 'Failed to decrypt SMTP password', details: decryptError.message },
        { status: 500 }
      );
    }
    // Create Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: smtpDetails.host,
      port: smtpDetails.port,
      secure: smtpDetails.port === 465,
      auth: {
        user: smtpDetails.username,
        pass: decryptedPassword,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
    });

    // Verify SMTP connection
try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError: any) {
      console.error('SMTP verification failed:', verifyError);
      return NextResponse.json(
        { error: 'Failed to verify SMTP connection', details: verifyError.message },
        { status: 500 }
      );
    }

    // Calculate total posts
    const totalPosts = Object.values(project.postTypes || {}).reduce((a: number, b: number) => a + (b as number), 0);
     const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://automation.rndtechnosoft.com';


    // Email template
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Project Assignment</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 0;
            color: #111827;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            overflow: hidden;
          }
          .header {
            background-color: #111827;
            padding: 24px;
            text-align: center;
            border-bottom: 1px solid #374151;
          }
          .header h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 600;
            color: #ffffff;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 32px;
          }
          .content p {
            font-size: 15px;
            line-height: 1.6;
            color: #374151;
            margin: 0 0 20px;
          }
          .details {
            background-color: #f9fafb;
            padding: 20px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            margin-bottom: 24px;
          }
          .details h2 {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .details p {
            font-size: 14px;
            margin: 8px 0;
            color: #4b5563;
          }
          .label {
            font-weight: 600;
            color: #111827;
            display: inline-block;
            width: 100px;
          }
          .value {
            color: #374151;
          }
          .button-container {
            text-align: center;
            margin-top: 32px;
            margin-bottom: 8px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #111827;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .button:hover {
            background-color: #374151;
          }
          .footer {
            background-color: #f9fafb;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 4px 0;
          }
          @media (max-width: 600px) {
            .container {
              margin: 20px;
              border-radius: 0;
              border-left: none;
              border-right: none;
            }
            .content {
              padding: 24px 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Project Assignment</h1>
          </div>
          <div class="content">
            <p>Dear ${assignedUser.name || 'Team Member'},</p>
            <p>You have been assigned to a new project: <strong style="color: #111827;">${project.name}</strong>. Please review the details below and coordinate with the project team to ensure successful execution.</p>
            
            <div class="details">
              <h2>Project Details</h2>
              <p><span class="label">Project:</span> <span class="value">${project.name}</span></p>
              <p><span class="label">Description:</span> <span class="value">${project.description || 'No description provided.'}</span></p>
            </div>
            
            <p>Please review the project details and reach out to the project manager${manager ? ` (${manager.name})` : ''} for any clarification. You can view the project in the dashboard for more details.</p>
            
            <div class="button-container">
              <a href="https://automation.rndtechnosoft.com/dashboard/projects/${validProjectId}" class="button">View Project in Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated email from itsmeDezino Agency ERP. Please do not reply directly to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Rndtechnosoft. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Log email details
    console.log('Email HTML prepared for:', assignedUser.email);

    // Send email
    await transporter.sendMail({
      from: `<${smtpDetails.username}>`,
      to: assignedUser.email,
      subject: `New Project Assignment: ${project.name}`,
      html: emailHtml,
    });

    console.log(`Email sent successfully to ${assignedUser.email} for project ${validProjectId}`);
    return NextResponse.json({ 
      message: 'Email sent successfully',
      projectId: validProjectId,
      assignedUserId: assignedUserId
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error sending email:', {
      message: error.message,
      code: error.code,
      command: error.command,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    );
  } finally {
    // await prisma.$disconnect();
  }
}