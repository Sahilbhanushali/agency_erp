import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import CryptoJS from 'crypto-js';
import { requireCan } from "@/lib/api-auth";
import { decryptSmtpPassword } from "@/lib/smtp";

const prisma = new PrismaClient();

// Encryption key (store securely in environment variables in production)
const ENCRYPTION_KEY = process.env.SMTP_PASSWORD_ENCRYPTION_KEY || 'your-32-byte-long-secret-key-here'; // Must be a secure, 32-byte key

// Encrypt password using crypto-js
function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
}

// Stored SMTP passwords exist in two encryption formats across this database's
// history. decryptSmtpPassword understands both and falls back to plaintext, so a row
// written by lib/encryption.ts no longer throws "Malformed UTF-8 data" here.
function decryptPassword(encryptedPassword: string): string {
  return decryptSmtpPassword(encryptedPassword);
}

// GET - Fetch all SMTP configurations for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCan("settings", "read");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;

    const smtpConfigs = await prisma.smtpDetails.findMany({
      select: {
        id: true,
        userId: true,
        host: true,
        port: true,
        username: true,
        encryption: true,
        password:true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // Transform the response to include user email directly
    const configs = smtpConfigs.map(config => ({
      id: config.id,
      userId: config.userId,
      host: config.host,
      port: config.port,
      username: config.username,
      encryption: config.encryption,
      password:decryptPassword(config.password),
      isActive: config.isActive,
      isVerified: config.isVerified,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      userEmail: config.user.email,
    }));

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Error fetching SMTP configurations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMTP configurations' },
      { status: 500 }
    );
  }
}

// POST - Create a new SMTP configuration
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("settings", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;

    const body = await request.json();
    const { host, port, username, password, encryption, userId } = body;

    // Validate required fields
    if (!host || !port || !username || !password || !encryption || !userId) {
      console.log('Missing fields:', { host, port, username, password, encryption, userId });
      return NextResponse.json(
        { error: 'All fields are required, including userId' },
        { status: 400 }
      );
    }

    // Validate encryption type
    if (!['TLS', 'SSL', 'NONE'].includes(encryption)) {
      return NextResponse.json(
        { error: 'Invalid encryption type' },
        { status: 400 }
      );
    }

    // Validate userId exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid userId' },
        { status: 400 }
      );
    }

    // Encrypt the password
    const encryptedPassword = encryptPassword(password);

    // Create new SMTP configuration
    const smtpDetails = await prisma.smtpDetails.create({
      data: {
        userId: parseInt(userId),
        host,
        port: parseInt(port),
        username,
        password: encryptedPassword,
        encryption,
        isActive: true,
        isVerified: false,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'CREATE',
        entityType: 'SmtpDetails',
        entityId: smtpDetails.id.toString(),
        newValues: JSON.stringify({
          host,
          port: parseInt(port),
          username,
          encryption,
          isActive: true,
          isVerified: false,
          userId: parseInt(userId),
        }),
      },
    });

    return NextResponse.json({
      message: 'SMTP configuration created successfully',
      configs: [
        {
          id: smtpDetails.id,
          userId: smtpDetails.userId,
          host: smtpDetails.host,
          port: smtpDetails.port,
          username: smtpDetails.username,
          encryption: smtpDetails.encryption,
          isActive: smtpDetails.isActive,
          isVerified: smtpDetails.isVerified,
          createdAt: smtpDetails.createdAt,
          updatedAt: smtpDetails.updatedAt,
        },
      ],
    });
  } catch (error) {
    console.error('Error creating SMTP configuration:', error);
    return NextResponse.json(
      { error: 'Failed to create SMTP configuration' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing SMTP configuration or test connection
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCan("settings", "update");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    if (!['ADMIN', 'MANAGER', 'Manager'].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden: ADMIN access required" }, { status: 403 });
    }

    const id = parseInt(session.user.id);
    const body = await request.json();
    const { userId, host, port, username, password, encryption, testConnection } = body;

    if (testConnection) {
      // Test SMTP connection
      const smtpDetails = await prisma.smtpDetails.findUnique({
        where: { userId }, // Remove userId check for admins, or keep it if needed
      });

      if (!smtpDetails) {
        return NextResponse.json(
          { error: `SMTP configuration not found for userId: ${userId}` },
          { status: 404 }
        );
      }

      // Decrypt the stored password for testing
      let decryptedPassword: string;
      try {
        decryptedPassword = decryptPassword(smtpDetails.password); // Use decryptPassword
      } catch (error) {
        console.error("Error decrypting password:", error);
        return NextResponse.json(
          { error: "Failed to decrypt password" },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport({
        host: smtpDetails.host,
        port: smtpDetails.port,
        secure: smtpDetails.encryption === "SSL",
        auth: {
          user: smtpDetails.username,
          pass: decryptedPassword,
        },
        ...(smtpDetails.encryption === "TLS" && {
          tls: {
            ciphers: "SSLv3",
            rejectUnauthorized: false,
          },
        }),
      });

      try {
        await transporter.verify();
      } catch (error: any) {
        console.error("SMTP connection test failed:", error);
        return NextResponse.json(
          { error: "SMTP connection test failed", details: error.message },
          { status: 400 }
        );
      }

      // Update isVerified status
      await prisma.smtpDetails.update({
        where: { userId }, // Remove userId check for admins, or keep it if needed
        data: { isVerified: true },
      });

      return NextResponse.json({
        message: "SMTP connection successful",
        success: true,
      });
    } else {
      // Update SMTP configuration
      if (!userId || !host || !port || !username || !password || !encryption) {
        return NextResponse.json(
          { error: "All fields (id, host, port, username, password, encryption) are required" },
          { status: 400 }
        );
      }

      if (!["TLS", "SSL", "NONE"].includes(encryption)) {
        return NextResponse.json(
          { error: "Invalid encryption type" },
          { status: 400 }
        );
      }

      // Verify the record exists before updating
      const existingSmtpDetails = await prisma.smtpDetails.findUnique({
        where: { userId }, // Remove userId check for admins, or keep it if needed
      });

      if (!existingSmtpDetails) {
        return NextResponse.json(
          { error: `SMTP configuration not found for id: ${userId}` },
          { status: 404 }
        );
      }

      // Encrypt the new password
      const encryptedPassword = encryptPassword(password);

      const smtpDetails = await prisma.smtpDetails.update({
        where: { userId }, // Remove userId check for admins, or keep it if needed
        data: {
          host,
          port: parseInt(port),
          username,
          password: encryptedPassword,
          encryption,
          updatedAt: new Date(),
          isVerified: false, // Reset verification on update
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "UPDATE",
          entityType: "SmtpDetails",
          entityId: smtpDetails.id.toString(),
          newValues: JSON.stringify({
            host,
            port: parseInt(port),
            username,
            encryption,
            isActive: smtpDetails.isActive,
            isVerified: false,
          }),
        },
      });

      return NextResponse.json({
        message: "SMTP configuration updated successfully",
        configs: [
          {
            id: smtpDetails.id,
            userId: smtpDetails.userId,
            host: smtpDetails.host,
            port: smtpDetails.port,
            username: smtpDetails.username,
            encryption: smtpDetails.encryption,
            isActive: smtpDetails.isActive,
            isVerified: smtpDetails.isVerified,
            createdAt: smtpDetails.createdAt,
            updatedAt: smtpDetails.updatedAt,
          },
        ],
      });
    }
  } catch (error: any) {
    console.error("Error in SMTP operation:", error);
    return NextResponse.json(
      { error: "Operation failed", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove an SMTP configuration
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'Configuration ID is required' }, { status: 400 });
    }

    const smtpDetails = await prisma.smtpDetails.findUnique({
      where: { id },
    });

    if (!smtpDetails) {
      return NextResponse.json(
        { error: 'SMTP configuration not found' },
        { status: 404 }
      );
    }

    await prisma.smtpDetails.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'SmtpDetails',
        entityId: id.toString(),
      },
    });

    return NextResponse.json({
      message: 'SMTP configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SMTP configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete SMTP configuration' },
      { status: 500 }
    );
  }
}