// scripts/dailyDesignerReport.js
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient();

async function sendDailyDesignerReport(recipients = []) {
  console.log('Starting sendDailyDesignerReport function at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  try {
    // Define the time range for today (IST)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    console.log('Time range for submissions:', today.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 'to', tomorrow.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

    // Prevent duplicate emails for the same day
    console.log('Checking for existing email log...');
    const existingLog = await prisma.auditLog.findFirst({
      where: {
        action: 'SEND_DAILY_DESIGNER_REPORT',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingLog) {
      console.log('Email already sent today, skipping execution');
      return;
    }

    // Find the Team Lead
    console.log('Querying for Team Lead...');
    const designerHead = await prisma.user.findFirst({
      where: {
        role: {
          name: 'Team Lead',
        },
      },
      include: {
        smtpDetails: true,
      },
    });

    if (!designerHead || !designerHead.smtpDetails) {
      console.error('Team Lead or SMTP details not found');
      return;
    }
    console.log('Team Lead found:', designerHead.email);

    // Query all design submissions for today
    console.log('Querying design submissions for today...');
    const submissions = await prisma.approvalFlow.findMany({
      where: {
        flowType: 'DESIGN',
        status: { in: ['SUBMITTED', 'RESUBMITTED'] },
        submittedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        post: {
          select: {
            title: true,
            project: {
              select: {
                name: true,
              },
            },
          },
        },
        submittedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    console.log('Found submissions:', submissions.length);

    // Prepare email content
    const totalSubmissions = submissions.length;
    let emailBody = `
      <h2>Daily Designer Submission Report - ${today.toDateString()}</h2>
      <p>Total Designs Submitted Today: ${totalSubmissions}</p>
      <h3>Details:</h3>
      <ul>
    `;

    submissions.forEach((submission) => {
      emailBody += `
        <li>
          <strong>Post:</strong> ${submission.post.title} (Project: ${submission.post.project.name})<br/>
          <strong>Designer:</strong> ${submission.submittedBy.name} (${submission.submittedBy.email})<br/>
          <strong>Submitted At:</strong> ${new Date(submission.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}<br/>
          <strong>Status:</strong> ${submission.status}
        </li>
      `;
    });

    emailBody += '</ul>';

    if (totalSubmissions === 0) {
      emailBody += '<p>No designs were submitted today.</p>';
    }

    console.log('Preparing to send email to:', designerHead.email);

    // Same formats as lib/smtp.ts; see scripts/smtp-password.js.
    const { openSmtpPassword } = require('./smtp-password');
    const decryptedPassword = openSmtpPassword(designerHead.smtpDetails.password);

    // Set up nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: designerHead.smtpDetails.host,
      port: designerHead.smtpDetails.port,
      secure: designerHead.smtpDetails.encryption === 'SSL',
      auth: {
        user: designerHead.smtpDetails.username,
        pass: decryptedPassword,
      },
    });

    // Send email
    console.log('Sending email...');
    await transporter.sendMail({
      from: designerHead.smtpDetails.username,
      // Settings -> Scheduled jobs can override who this goes to.
      to: recipients.length > 0 ? recipients.join(', ') : designerHead.email,
      subject: `Daily Designer Submission Report - ${today.toDateString()}`,
      html: emailBody,
    });

    console.log('Daily designer report email sent to', recipients.length > 0 ? recipients.join(', ') : designerHead.email);

    // Log the email action to prevent duplicates
    console.log('Logging email action to auditLog...');
    await prisma.auditLog.create({
      data: {
        action: 'SEND_DAILY_DESIGNER_REPORT',
        entityType: 'Email',
        userId: designerHead.id,
        newValues: JSON.stringify({ totalSubmissions }),
        createdAt: new Date(),
      },
    });
    console.log('Audit log created');
  } catch (error) {
    console.error('Error sending daily designer report:', error.message);
  } finally {
    console.log('Disconnecting Prisma client...');
    await prisma.$disconnect();
    console.log('Prisma disconnected');
  }
}

module.exports = { sendDailyDesignerReport };
