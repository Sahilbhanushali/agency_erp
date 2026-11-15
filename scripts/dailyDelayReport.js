const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const prisma = new PrismaClient();

function getPostTimingInfo(post) {
  if (!post.scheduledAt) return null;
  const postingDate = new Date(post.scheduledAt);
  if (isNaN(postingDate.getTime())) return null;

  const designAssets = (post.assets || []).filter(a => !a.isReference);
  const hasDesign = designAssets.length > 0;

  let comparisonDate;
  let isUploaded = false;

  if (hasDesign) {
    const assetDates = designAssets
      .map(a => (a.createdAt ? new Date(a.createdAt).getTime() : NaN))
      .filter(t => !isNaN(t));
    comparisonDate = assetDates.length > 0 ? new Date(Math.min(...assetDates)) : new Date();
    isUploaded = true;
  } else {
    comparisonDate = new Date();
    isUploaded = false;
  }

  const postDay = new Date(postingDate.getFullYear(), postingDate.getMonth(), postingDate.getDate());
  const compareDay = new Date(comparisonDate.getFullYear(), comparisonDate.getMonth(), comparisonDate.getDate());

  const diffTime = postDay.getTime() - compareDay.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (isUploaded) {
    if (diffDays >= 15) return { status: 'BEFORE_TIME', diffDays };
    if (diffDays >= 7) return { status: 'ON_TIME', diffDays };
    if (diffDays >= 2) return { status: 'DELAY', diffDays };
    return { status: 'VERY_MUCH_DELAY', diffDays };
  } else {
    if (diffDays >= 7) return null;
    if (diffDays >= 2) return { status: 'DELAY', diffDays };
    return { status: 'VERY_MUCH_DELAY', diffDays };
  }
}

function getProjectTimingInfo(posts) {
  if (!posts || posts.length === 0) return null;
  const allPosted = posts.length > 0 && posts.every((post) => post.status === 'POSTED');
  if (allPosted) return { status: 'COMPLETED', diffDays: 0 };

  const validTimings = posts
    .filter((post) => post.status !== 'POSTED')
    .map(getPostTimingInfo)
    .filter((t) => t !== null);

  if (validTimings.length === 0) return null;

  const avgDiffDays = Math.round(
    validTimings.reduce((sum, t) => sum + t.diffDays, 0) / validTimings.length
  );

  if (avgDiffDays >= 15) return { status: 'BEFORE_TIME', diffDays: avgDiffDays };
  if (avgDiffDays >= 7) return { status: 'ON_TIME', diffDays: avgDiffDays };
  if (avgDiffDays >= 2) return { status: 'DELAY', diffDays: avgDiffDays };
  return { status: 'VERY_MUCH_DELAY', diffDays: avgDiffDays };
}

async function sendDailyDelayReport(recipients = []) {
  console.log('Starting sendDailyDelayReport function at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const existingLog = await prisma.auditLog.findFirst({
      where: {
        action: 'SEND_DAILY_DELAY_REPORT',
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    if (existingLog) {
      console.log('Delay email report already sent today, skipping execution');
      return;
    }

    // Whichever account has SMTP configured sends it. There is one agency mailbox, so
    // naming a specific person here only broke the job when that person left.
    const adminUser = await prisma.user.findFirst({
      where: { smtpDetails: { isNot: null } },
      include: { smtpDetails: true },
      orderBy: { id: 'asc' },
    });

    if (!adminUser || !adminUser.smtpDetails) {
      console.error('Admin SMTP details not found');
      return;
    }

    const projects = await prisma.project.findMany({
      where: { isActive: true },
      include: {
        client: true,
        posts: {
          include: { assets: true }
        }
      }
    });

    // Calculate metrics exactly like the frontend
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const delayedProjects = [];
    const onTimeProjects = [];

    projects.forEach(project => {
      // Calculate target posts
      const postTypes = project.postTypes || {};
      const targetPosts = typeof postTypes === 'object' ? Object.values(postTypes).reduce((sum, count) => sum + (Number(count) || 0), 0) : 0;

      // Filter posts for current month/year
      const monthPosts = (project.posts || []).filter(post => {
        const dateStr = post.scheduledAt || post.createdAt;
        if (!dateStr) return false;
        const postDate = new Date(dateStr);
        if (isNaN(postDate.getTime())) return false;
        return postDate.getFullYear() === currentYear && (postDate.getMonth() + 1) === currentMonth;
      });

      let designUploaded = 0;
      let clientApproved = 0;
      let scheduledCount = 0;
      let postedCount = 0;

      monthPosts.forEach(post => {
        if (post.assets && post.assets.some(asset => !asset.isReference)) {
          designUploaded++;
        }
        if (post.status === "C_APPROVED") clientApproved++;
        else if (post.status === "SCHEDULED") scheduledCount++;
        else if (post.status === "POSTED") postedCount++;
      });

      const timing = getProjectTimingInfo(monthPosts);
      
      if (timing) {
        const projectData = {
          name: project.name,
          client: project.client ? project.client.company : 'Unknown',
          status: timing.status, // 'DELAY', 'VERY_MUCH_DELAY', 'ON_TIME', 'BEFORE_TIME', 'COMPLETED'
          target: targetPosts,
          created: monthPosts.length,
          design: designUploaded,
          ca: clientApproved,
          scheduled: scheduledCount,
          posted: postedCount
        };

        if (timing.status === 'DELAY' || timing.status === 'VERY_MUCH_DELAY') {
          delayedProjects.push(projectData);
        } else if (timing.status === 'ON_TIME' || timing.status === 'BEFORE_TIME' || timing.status === 'COMPLETED') {
          onTimeProjects.push(projectData);
        }
      }
    });

    let totalDelay = 0;
    let totalVeryMuchDelay = 0;
    let totalOnTime = 0;
    let totalBeforeTime = 0;
    let totalCompleted = 0;

    delayedProjects.forEach(p => {
      if (p.status === 'DELAY') totalDelay++;
      else if (p.status === 'VERY_MUCH_DELAY') totalVeryMuchDelay++;
    });

    onTimeProjects.forEach(p => {
      if (p.status === 'ON_TIME') totalOnTime++;
      else if (p.status === 'BEFORE_TIME') totalBeforeTime++;
      else if (p.status === 'COMPLETED') totalCompleted++;
    });

    // Helper function to render a table row
    const renderRow = (p, index) => {
      let statusColor = '#6b7280';
      let statusText = p.status;
      let statusStyle = 'font-size: 12px; font-weight: 600;';

      if (p.status === 'DELAY') {
        statusColor = '#dc2626';
        statusText = '[Delay]';
        statusStyle += ` color: ${statusColor};`;
      } else if (p.status === 'VERY_MUCH_DELAY') {
        statusColor = '#dc2626';
        statusText = '[Very Much Delay]';
        statusStyle += ` color: ${statusColor}; font-weight: bold;`;
      } else if (p.status === 'ON_TIME') {
        statusColor = '#059669';
        statusText = '[On Time]';
        statusStyle += ` color: ${statusColor};`;
      } else if (p.status === 'BEFORE_TIME') {
        statusColor = '#2563eb';
        statusText = '[Before Time]';
        statusStyle += ` color: ${statusColor}; font-weight: bold;`;
      } else if (p.status === 'COMPLETED') {
        statusColor = '#111827';
        statusText = '[Completed]';
        statusStyle += ` color: ${statusColor}; font-weight: bold;`;
      }

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; color: #6b7280; border-right: 1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding: 12px; text-align: left; border-right: 1px solid #e5e7eb;">
            <div style="color: #2563eb; font-weight: 600; font-size: 14px; margin-bottom: 4px;">${p.name}</div>
            <div style="${statusStyle}">${statusText}</div>
          </td>
          <td style="padding: 12px; text-align: left; color: #374151; border-right: 1px solid #e5e7eb;">${p.client}</td>
          <td style="padding: 12px; border-right: 1px solid #e5e7eb;">
            <span style="border: 1px solid #e5e7eb; border-radius: 9999px; padding: 2px 10px; font-weight: 500;">${p.target}</span>
          </td>
          <td style="padding: 12px; border-right: 1px solid #e5e7eb;">
            <span style="background-color: #f3f4f6; color: #111827; border-radius: 9999px; padding: 2px 10px; font-weight: 600;">${p.created}</span>
          </td>
          <td style="padding: 12px; border-right: 1px solid #e5e7eb;">
            <span style="background-color: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; border-radius: 9999px; padding: 2px 10px; font-weight: 600;">${p.design}</span>
          </td>
          <td style="padding: 12px; border-right: 1px solid #e5e7eb;">
            <span style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 9999px; padding: 2px 10px; font-weight: 600;">${p.ca}</span>
          </td>
          <td style="padding: 12px; border-right: 1px solid #e5e7eb;">
            <span style="background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; border-radius: 9999px; padding: 2px 10px; font-weight: 600;">${p.scheduled}</span>
          </td>
          <td style="padding: 12px;">
            <span style="background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 9999px; padding: 2px 10px; font-weight: 600;">${p.posted}</span>
          </td>
        </tr>
      `;
    };

    let emailBody = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #111827; font-size: 24px; font-weight: bold;">📊 Daily Project Status Report - ${today.toLocaleDateString('en-IN')}</h2>
        
        <div style="display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 12px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
            <div style="color: #dc2626; font-size: 14px; font-weight: 600;">Very Much Delay</div>
            <div style="color: #b91c1c; font-size: 24px; font-weight: bold; margin-top: 4px;">${totalVeryMuchDelay}</div>
          </div>
          <div style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 12px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
            <div style="color: #d97706; font-size: 14px; font-weight: 600;">Delay</div>
            <div style="color: #b45309; font-size: 24px; font-weight: bold; margin-top: 4px;">${totalDelay}</div>
          </div>
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
            <div style="color: #059669; font-size: 14px; font-weight: 600;">On Time</div>
            <div style="color: #047857; font-size: 24px; font-weight: bold; margin-top: 4px;">${totalOnTime}</div>
          </div>
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
            <div style="color: #2563eb; font-size: 14px; font-weight: 600;">Before Time</div>
            <div style="color: #1d4ed8; font-size: 24px; font-weight: bold; margin-top: 4px;">${totalBeforeTime}</div>
          </div>
          <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 12px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
            <div style="color: #111827; font-size: 14px; font-weight: 600;">Completed</div>
            <div style="color: #000000; font-size: 24px; font-weight: bold; margin-top: 4px;">${totalCompleted}</div>
          </div>
        </div>
    `;

    // Render Delayed Projects Table
    if (delayedProjects.length > 0) {
      emailBody += `
        <h3 style="color: #dc2626; margin-top: 30px;">🚨 Delayed Projects</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 14px; text-align: center;">
          <thead>
            <tr style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; height: 48px;">
              <th style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb; color: #6b7280;">#</th>
              <th style="padding: 12px; text-align: left; border-right: 1px solid #e5e7eb; min-width: 200px; color: #111827;">Project Name</th>
              <th style="padding: 12px; text-align: left; border-right: 1px solid #e5e7eb; min-width: 160px; color: #111827;">Company Name</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Target</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Post Created</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Design</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">CA</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Scheduled</th>
              <th style="padding: 12px; color: #111827;">Post</th>
            </tr>
          </thead>
          <tbody>
            ${delayedProjects.map((p, i) => renderRow(p, i)).join('')}
          </tbody>
        </table>
      `;
    } else {
      emailBody += `<p style="color: #059669; font-weight: bold; margin-top: 30px;">✅ No delayed projects today!</p>`;
    }

    // Render On-Time Projects Table
    if (onTimeProjects.length > 0) {
      emailBody += `
        <h3 style="color: #059669; margin-top: 40px;">✅ On-Time & Before-Time Projects</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 14px; text-align: center;">
          <thead>
            <tr style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; height: 48px;">
              <th style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb; color: #6b7280;">#</th>
              <th style="padding: 12px; text-align: left; border-right: 1px solid #e5e7eb; min-width: 200px; color: #111827;">Project Name</th>
              <th style="padding: 12px; text-align: left; border-right: 1px solid #e5e7eb; min-width: 160px; color: #111827;">Company Name</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Target</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Post Created</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Design</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">CA</th>
              <th style="padding: 12px; border-right: 1px solid #e5e7eb; color: #111827;">Scheduled</th>
              <th style="padding: 12px; color: #111827;">Post</th>
            </tr>
          </thead>
          <tbody>
            ${onTimeProjects.map((p, i) => renderRow(p, i)).join('')}
          </tbody>
        </table>
      `;
    }

    emailBody += `
        <br/><br/>
        <p style="color: #4b5563;">Please review these projects on the dashboard.</p>
      </div>
    `;

    // Same formats as lib/smtp.ts; see scripts/smtp-password.js.
    const { openSmtpPassword } = require('./smtp-password');
    const decryptedPassword = openSmtpPassword(adminUser.smtpDetails.password);

    const transporter = nodemailer.createTransport({
      host: adminUser.smtpDetails.host,
      port: adminUser.smtpDetails.port,
      secure: adminUser.smtpDetails.encryption === 'SSL',
      auth: {
        user: adminUser.smtpDetails.username,
        pass: decryptedPassword,
      },
    });

    // Recipients come from Settings -> Scheduled jobs. No built-in list: a hardcoded
    // one silently mailed the wrong people for as long as nobody checked.
    if (recipients.length === 0) {
      console.error('No recipients configured for the delay report — nothing sent.');
      return;
    }
    
    await transporter.sendMail({
      from: adminUser.smtpDetails.username,
      to: recipients.join(', '),
      subject: `🚨 Project Delay Alert - ${new Date().toLocaleDateString('en-IN')}`,
      html: emailBody,
    });

    console.log('Daily delay report sent to', recipients.join(', '));

    await prisma.auditLog.create({
      data: {
        action: 'SEND_DAILY_DELAY_REPORT',
        entityType: 'Email',
        userId: adminUser.id,
        newValues: JSON.stringify({ delayedCount: delayedProjects.length }),
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error sending daily delay report:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { sendDailyDelayReport };
