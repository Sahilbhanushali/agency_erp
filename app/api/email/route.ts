import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Adjust path to your NextAuth config
import CryptoJS from 'crypto-js';
import { requireCan } from "@/lib/api-auth";

const prisma = new PrismaClient();

export async function POST(request: Request) {
    const body = await request.json();
    const {
      title,
      caption,
      type,
      platforms,
      projectId,
      scheduledAt,
      assignedToId,
      festivalId,
      customData,
      assets, // May be binary or [{ url: string }]
    } = body;
  
    try {

    const auth = await requireCan("posts", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
      // Fetch assigned user's email and name
      const assignedUser = await prisma.user.findUnique({
        where: { id: parseInt(assignedToId) },
        select: { email: true, name: true },
      });
  
      if (!assignedUser) {
        console.error(`Assigned user not found for ID: ${assignedToId}`);
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 400 });
      }
  
      // Fetch project name
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
  
      if (!project) {
        console.error(`Project not found for ID: ${projectId}`);
        return NextResponse.json({ error: 'Project not found' }, { status: 400 });
      }
  
      // Fetch festival name if festivalId is provided
      const festival = festivalId
        ? await prisma.festival.findUnique({ where: { id: festivalId }, select: { name: true } })
        : null;
  
      // Fetch asset details from the Post model (created by /api/post)
      let assetUrl: string | null = null;
      if (assets && Array.isArray(assets) && assets.length > 0 && assets[0].url) {
        assetUrl = assets[0].url; // Use asset URL from payload if provided
      } else {
        // Query the Post model for assets
        const post = await prisma.post.findFirst({
          where: { projectId, title }, // Match post by projectId and title
          select: {
            assets: {
              orderBy: { order: 'asc' },
              select: { url: true },
              take: 1, // Get the first asset
            },
          },
        });
        if (post?.assets && post.assets.length > 0) {
          // Prepend base URL to make it fully qualified
          assetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://automation.rndtechnosoft.com'}${post.assets[0].url}`;
        }
      }
  
      // Fetch SMTP details for the session user
      const smtpDetails = await prisma.smtpDetails.findUnique({
        where:  { userId: parseInt(session.user.id) }, // Hardcoded for testing; revert to session-based in production
        select: { host: true, port: true, username: true, password: true, encryption: true, isVerified: true },
      });
  
      if (!smtpDetails) {
        console.error('No SMTP details found for user ID: 1');
        return NextResponse.json({ error: 'SMTP details not configured for the user' }, { status: 400 });
      }
  
      if (!smtpDetails.isVerified) {
        console.error('SMTP configuration not verified for user ID: 1');
        return NextResponse.json({ error: 'SMTP configuration is not verified' }, { status: 400 });
      }
  
      // Log SMTP configuration (exclude password)
      console.log('SMTP configuration:', {
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
  
      // Email template
      const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Post Assignment</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              background-color: #f4f4f9;
              margin: 0;
              padding: 0;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background-color: #111827;
              padding: 20px;
              text-align: center;
              color: #ffffff;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px;
            }
            .content p {
              font-size: 16px;
              line-height: 1.6;
              margin: 0 0 20px;
            }
            .details {
              background-color: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .details h2 {
              font-size: 18px;
              font-weight: 600;
              color: #111827;
              margin: 0 0 15px;
            }
            .details p {
              font-size: 14px;
              margin: 8px 0;
            }
            .label {
              font-weight: 600;
              color: #555;
            }
            .value {
              color: #333;
            }
            .reference-link {
              color: #374151;
              text-decoration: none;
              font-weight: 500;
            }
            .reference-link:hover {
              text-decoration: underline;
            }
            .asset-image {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              margin: 20px 0;
              display: block;
            }
            .footer {
              background-color: #f4f4f9;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #777;
              border-top: 1px solid #e5e5e5;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #111827;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              margin-top: 20px;
            }
            .button:hover {
              background-color: #1557b0;
            }
            @media (max-width: 600px) {
              .container {
                margin: 20px;
              }
              .content {
                padding: 20px;
              }
              .asset-image {
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Post Assignment</h1>
            </div>
            <div class="content">
              <p>Dear ${assignedUser.name || 'Team Member'},</p>
              <p>You have been assigned a new post for the project <strong>${project.name}</strong>. Please review the details below and take the necessary actions to ensure timely completion.</p>
              
   
              
              <div class="details">
                <h2>Post Details</h2>
                <p><span class="label">Title:</span> <span class="value">${title}</span></p>

              </div>
              

              
              <p>Please review the post details and coordinate with the project team as needed. If you have any questions, contact the project manager.</p>
              
              <a href="https://automation.rndtechnosoft.com/dashboard/projects/posts?projectId=${projectId}" class="button">View Post in Dashboard</a>
            </div>
            <div class="footer">
              <p>This is an automated email from RndTechnosoft. Please do not reply directly to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Rndtechnosoft. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
  
      // Log email details
      console.log('Email HTML prepared for:', assignedUser.email, { assetUrl });
  
      // Send email
      await transporter.sendMail({
        from: ` <${smtpDetails.username}>`,
        to: assignedUser.email,
        subject: `New Post Assignment: ${title}`,
        html: emailHtml,
      });
  
      console.log(`Email sent successfully to ${assignedUser.email}`);
      return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 });
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
    //   await prisma.$disconnect();
    }
  }