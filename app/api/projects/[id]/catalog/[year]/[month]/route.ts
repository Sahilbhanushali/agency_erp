import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import { requireCan } from "@/lib/api-auth";
const prisma = new PrismaClient();

interface Params {
  id: string;
  year: string;
  month: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireCan("projects", "read");
  if (!auth.ok) return auth.response;

  try {
    const { id, year, month } = await params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'pdf';

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month parameter' },
        { status: 400 }
      );
    }

    const projectData = await getProjectCatalogData(id, yearNum, monthNum);

    if (!projectData) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (format === 'json') {
      return NextResponse.json(projectData);
    }

    const pdfBuffer = await generateProfessionalPDFCatalog(projectData, yearNum, monthNum);
    
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sanitizeFileName(projectData.name)}-catalog-${year}-${month.padStart(2, '0')}.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating catalog:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to generate catalog',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

async function getProjectCatalogData(projectId: string, year: number, month: number) {
  try {
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
      throw new Error('Invalid project ID');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        manager: {
          select: { id: true, name: true, email: true }
        },
        assignedUsers: {
          select: { id: true, name: true, email: true, role: true }
        },
        posts: {
          where: {
            scheduledAt: { gte: startDate, lte: endDate }
          },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            festival: { select: { id: true, name: true, date: true, description: true } },
            assets: { orderBy: { order: 'asc' } },
            platforms: true
          },
          orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Assertion: Ensure all retrieved posts have scheduled dates within the requested month/year
    project.posts.forEach((post) => {
      if (!post.scheduledAt) {
        throw new Error(
          `Data integrity assertion failed: Post "${post.title}" has no scheduled date but was retrieved in the catalog for ${year}-${month}`
        );
      }
      const postDate = new Date(post.scheduledAt);
      const postYear = postDate.getUTCFullYear();
      const postMonth = postDate.getUTCMonth() + 1;
      if (postYear !== year || postMonth !== month) {
        throw new Error(
          `Data integrity assertion failed: Post "${post.title}" scheduled for ${post.scheduledAt.toISOString()} falls outside the catalog period ${year}-${month}`
        );
      }
    });

    // De-duplicate posts by (title + caption + scheduledAt date)
    const uniquePostsMap = new Map<string, any>();
    project.posts.forEach((post) => {
      const titleKey = (post.title || '').trim().toLowerCase();
      const captionKey = (post.caption || '').trim().toLowerCase();
      const dateKey = post.scheduledAt 
        ? new Date(post.scheduledAt).toISOString()
        : (post.postedAt ? new Date(post.postedAt).toISOString() : post.createdAt.toISOString());
      
      const key = `${titleKey}::${captionKey}::${dateKey}`;
      if (!uniquePostsMap.has(key)) {
        uniquePostsMap.set(key, post);
      }
    });
    project.posts = Array.from(uniquePostsMap.values());

    const summary = {
      totalPosts: project.posts.length,
      postsByStatus: project.posts.reduce((acc: Record<string, number>, post) => {
        acc[post.status] = (acc[post.status] || 0) + 1;
        return acc;
      }, {}),
      scheduledPosts: project.posts.filter(p => p.scheduledAt).length,
      postedPosts: project.posts.filter(p => p.postedAt).length
    };

    return {
      ...project,
      summary,
      catalogGeneratedAt: new Date(),
      catalogPeriod: { year, month }
    };
  } catch (error) {
    console.error('Error fetching project data:', error);
    throw error;
  }
}

async function loadImageAsBase64(url: string): Promise<{data: string, format: string} | null> {
  try {
    let format = 'JPEG';
    if (url.toLowerCase().includes('.png')) format = 'PNG';
    else if (url.toLowerCase().includes('.gif')) format = 'GIF';
    else if (url.toLowerCase().includes('.webp')) format = 'WEBP';

    // Handle local files (like /letterhead.png) directly via file system
    if (url.startsWith('/')) {
      const filePath = path.join(process.cwd(), 'public', url);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        let contentType = 'image/jpeg';
        if (format === 'PNG') contentType = 'image/png';
        else if (format === 'GIF') contentType = 'image/gif';
        else if (format === 'WEBP') contentType = 'image/webp';
        
        return {
          data: `data:${contentType};base64,${base64}`,
          format: format
        };
      }
    }

    let imageUrl = url;
    if (url.startsWith('/')) {
      imageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${url}`;
    }
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('png') && format === 'JPEG') format = 'PNG';
    else if (contentType.includes('gif') && format === 'JPEG') format = 'GIF';
    else if (contentType.includes('webp') && format === 'JPEG') format = 'WEBP';
    
    return {
      data: `data:${contentType || 'image/jpeg'};base64,${base64}`,
      format: format
    };
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

function sanitizeFileName(filename: string): string {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function cleanText(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
}

async function generateProfessionalPDFCatalog(projectData: any, year: number, month: number): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const colors = {
        primary: [31, 81, 255],
        secondary: [71, 85, 105],
        accent: [139, 69, 19],
        light: [248, 250, 252],
        success: [34, 197, 94],
        text: [15, 23, 42]
      };

      const setColor = (color: number[]) => {
        doc.setTextColor(color[0], color[1], color[2]);
      };

      const setFillColor = (color: number[]) => {
        doc.setFillColor(color[0], color[1], color[2]);
      };

      // Load letterhead image
      const letterheadUrl = '/letterhead.png';
      const letterheadImage = await loadImageAsBase64(letterheadUrl);

      const addHeader = () => {
        const pageCount = doc.getCurrentPageInfo().pageNumber;
        if (pageCount === 1) {
          // Add letterhead image on cover page
          if (letterheadImage && letterheadImage.data) {
            try {
              doc.addImage(
                letterheadImage.data,
                letterheadImage.format,
                10, // Left margin
                10, // Top margin
                190, // Width (fits A4 width with margins)
                30, // Height
                undefined,
                'FAST'
              );
              return;
            } catch (error) {
              console.error('Error adding letterhead image:', error);
            }
          }
          // Fallback full header
          setFillColor(colors.primary);
          doc.rect(0, 0, 210, 30, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text('CONTENT CATALOG', 20, 18);
        } else {
          // Slim logo + page title header
          setFillColor(colors.primary);
          doc.rect(0, 0, 210, 12, 'F');
          
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(cleanText(projectData.name).toUpperCase(), 15, 8);
          
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          const periodText = `${getMonthName(month)} ${year} Content Report`;
          doc.text(periodText, 195, 8, { align: 'right' });
        }
      };

      const addFooter = () => {
        const pageCount = doc.getCurrentPageInfo().pageNumber;
        setColor(colors.secondary);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${pageCount}`, 190, 285, { align: 'right' });
        doc.text(`${cleanText(projectData.name)} - ${getMonthName(month)} ${year}`, 20, 285);
      };

      const reserveHeight = (neededHeight: number, currentY: number): number => {
        if (currentY + neededHeight > 275) {
          addFooter();
          doc.addPage();
          addHeader();
          return 22; // Start below the slim header
        }
        return currentY;
      };

      let y = 50; // Start below letterhead
      addHeader();

      // Project Title Section (Page 1)
      setFillColor(colors.light);
      doc.rect(15, y, 180, 32, 'F');
      
      // Top accent bar
      setFillColor(colors.primary);
      doc.rect(15, y, 180, 3, 'F');

      setColor(colors.primary);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      const projectTitle = cleanText(projectData.name);
      doc.text(projectTitle, 105, y + 13, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      setColor(colors.secondary);
      doc.text(`${getMonthName(month)} ${year} Content Report`, 105, y + 23, { align: 'center' });
      
      y += 42;

      // Project Overview (Page 1)
      setFillColor([255, 255, 255]);
      doc.rect(15, y, 180, 38, 'F');
      setColor([226, 232, 240]);
      doc.setLineWidth(0.5);
      doc.rect(15, y, 180, 38, 'S');

      // Left accent bar
      setFillColor(colors.primary);
      doc.rect(15, y, 3, 38, 'F');

      setColor(colors.primary);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PROJECT OVERVIEW', 25, y + 9);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      setColor(colors.text);
      
      const overviewData = [
        [`Client:`, cleanText(projectData.client.name)],
        [`Manager:`, cleanText(projectData.manager?.name || 'Unassigned')],
        [`Total Posts:`, projectData.summary.totalPosts.toString()],
        [`Status:`, `${projectData.summary.postedPosts} Published, ${projectData.summary.scheduledPosts} Scheduled`]
      ];

      overviewData.forEach(([label, value], index) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 30, y + 17 + (index * 5));
        doc.setFont('helvetica', 'normal');
        doc.text(value, 80, y + 17 + (index * 5));
      });

      y += 48;

      // --- SUMMARY DASHBOARD (Page 1) ---
      // Compute aggregates
      const contentStatusCounts: Record<string, number> = {};
      const designStatusCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};

      projectData.posts.forEach((post: any) => {
        const cStatus = post.contentStatus || 'DRAFT';
        contentStatusCounts[cStatus] = (contentStatusCounts[cStatus] || 0) + 1;

        const dStatus = post.status || 'DRAFT';
        designStatusCounts[dStatus] = (designStatusCounts[dStatus] || 0) + 1;

        const pType = post.type || 'PHOTO';
        typeCounts[pType] = (typeCounts[pType] || 0) + 1;
      });

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      setColor(colors.primary);
      doc.text('SUMMARY DASHBOARD', 15, y);
      y += 4;

      // Draw 3 columns for metrics
      const colW = 56;
      const colH = 32;
      const gap = 6;
      const metrics = [
        { title: 'CONTENT STATUS', data: contentStatusCounts },
        { title: 'DESIGN STATUS', data: designStatusCounts },
        { title: 'POST TYPES', data: typeCounts }
      ];

      metrics.forEach((metric, index) => {
        const colX = 15 + index * (colW + gap);
        // Card bg and border
        setFillColor([250, 251, 252]);
        doc.rect(colX, y, colW, colH, 'F');
        setColor([226, 232, 240]);
        doc.setLineWidth(0.4);
        doc.rect(colX, y, colW, colH, 'S');

        // Column Top Bar
        setFillColor(colors.primary);
        doc.rect(colX, y, colW, 2, 'F');

        // Column Header Text
        setColor(colors.primary);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text(metric.title, colX + 4, y + 6);

        // List stats
        doc.setFontSize(8);
        let statY = y + 12;
        Object.entries(metric.data).forEach(([key, val]) => {
          doc.setFont('helvetica', 'bold');
          setColor(colors.secondary);
          doc.text(key, colX + 4, statY);

          doc.setFont('helvetica', 'normal');
          setColor(colors.text);
          doc.text(val.toString(), colX + colW - 8, statY, { align: 'right' });
          statY += 4.5;
        });
      });

      y += colH + 12;

      // --- SCHEDULED TIMELINE (Page 1) ---
      const scheduledPosts = projectData.posts
        .filter((p: any) => p.scheduledAt)
        .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

      if (scheduledPosts.length > 0) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        setColor(colors.primary);
        doc.text('SCHEDULED TIMELINE', 15, y);
        y += 4;

        // Draw vertical timeline line
        const timelineStartY = y + 2;
        const timelineEndY = Math.min(y + (scheduledPosts.slice(0, 5).length * 7) - 3, 260);
        doc.setLineWidth(0.5);
        setColor([200, 208, 218]);
        doc.line(18, timelineStartY, 18, timelineEndY);

        scheduledPosts.slice(0, 5).forEach((post: any, index: number) => {
          const itemY = y + 2 + (index * 7);

          // Draw timeline circle
          setFillColor(colors.primary);
          doc.circle(18, itemY, 1.2, 'FD');

          // Date label
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          setColor(colors.primary);
          const dateStr = new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          doc.text(dateStr, 22, itemY + 0.8);

          // Title & Type
          doc.setFont('helvetica', 'normal');
          setColor(colors.text);
          const cleanPostTitle = cleanText(post.title);
          const titleShort = cleanPostTitle.length > 40 ? cleanPostTitle.substring(0, 40) + '...' : cleanPostTitle;
          doc.text(`- ${titleShort}`, 38, itemY + 0.8);

          doc.setFont('helvetica', 'bold');
          setColor(colors.secondary);
          const typeLabel = `(${post.type || 'PHOTO'})`;
          doc.text(typeLabel, 38 + doc.getTextWidth(`- ${titleShort}`) + 3, itemY + 0.8);
        });
      }

      // Cover Page ends here. Add footer, insert page break, and start Page 2!
      addFooter();
      doc.addPage();
      addHeader();
      y = 22; // Start below slim header on Page 2

      // ─── MAGAZINE LAYOUT HELPERS ────────────────────────────────────────────

      // Page dimensions
      const PAGE_W = 210;
      const LEFT_MARGIN = 12;
      const RIGHT_MARGIN = 12;
      const CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN; // 186mm

      // Type icon map for badge overlay
      const typeIconLabel: Record<string, string> = {
        PHOTO: 'PH', REEL: 'RL', STORY: 'ST', CAROUSEL: 'CR', VIDEO: 'VD', CUSTOM: 'CX'
      };

      // Type accent colours (bg fill rgb)
      const typeAccentColor: Record<string, number[]> = {
        PHOTO:    [31,  81,  255],
        REEL:     [124, 58,  237],
        STORY:    [217, 70,  239],
        CAROUSEL: [8,   145, 178],
        VIDEO:    [220, 38,  38],
        CUSTOM:   [71,  85,  105],
      };

      /** Render a post image into a given rect, or draw a soft placeholder */
      const renderImage = async (
        imgX: number, imgY: number, imgW: number, imgH: number,
        post: any
      ) => {
        const imageAssets = (post.assets || []).filter((asset: any) =>
          asset.type?.toLowerCase().includes('image') ||
          ['jpg','jpeg','png','gif','bmp','webp'].some((ext: string) => asset.filename?.toLowerCase().endsWith(ext))
        );

        if (imageAssets.length > 0 && imageAssets[0].url) {
          try {
            const imageResult = await loadImageAsBase64(imageAssets[0].url);
            if (imageResult?.data) {
              doc.addImage(imageResult.data, imageResult.format, imgX, imgY, imgW, imgH, undefined, 'FAST');
              return;
            }
          } catch (_) {}
        }
        // Soft placeholder — muted fill, centred label, NO border
        setFillColor([241, 245, 249]);
        doc.rect(imgX, imgY, imgW, imgH, 'F');
        setColor([148, 163, 184]);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text('No image', imgX + imgW / 2, imgY + imgH / 2 - 2, { align: 'center' });
        doc.text('uploaded', imgX + imgW / 2, imgY + imgH / 2 + 2.5, { align: 'center' });
      };

      /** Draw a small pill badge */
      const drawBadge = (
        bx: number, by: number,
        text: string,
        bgRgb: number[], textRgb: number[]
      ): number => {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        const tw = doc.getTextWidth(text);
        const bw = tw + 4;
        const bh = 3.8;
        setFillColor(bgRgb);
        doc.roundedRect(bx, by - 2.8, bw, bh, 0.8, 0.8, 'F');
        doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
        doc.text(text, bx + 2, by + 0.3);
        return bw + 2; // return badge width + gap
      };

      /** Draw the type icon chip in the top-left corner of an image */
      const drawTypeChip = (imgX: number, imgY: number, type: string) => {
        const label = typeIconLabel[type] || 'PO';
        const accentRgb = typeAccentColor[type] || colors.secondary;
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        const chipW = doc.getTextWidth(label) + 4;
        setFillColor(accentRgb);
        doc.rect(imgX, imgY, chipW, 5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(label, imgX + 2, imgY + 3.5);
      };

      /** Draw a wayfinding "Week of …" label */
      const drawWeekLabel = (weekLabel: string, atY: number) => {
        setFillColor([248, 250, 252]);
        doc.rect(LEFT_MARGIN, atY, CONTENT_W, 7, 'F');
        setFillColor(colors.primary);
        doc.rect(LEFT_MARGIN, atY, 2.5, 7, 'F');
        setColor(colors.primary);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(weekLabel, LEFT_MARGIN + 6, atY + 4.8);
        return atY + 9; // returns new y after the label
      };

      /** Render HERO card: full-width, image left 45%, text right 55% */
      const renderHeroCard = async (post: any, postIndex: number, atY: number): Promise<number> => {
        const isFestival = !!post.festival;
        const cardH = 62;
        const imgW = Math.round(CONTENT_W * 0.45);
        const textW = CONTENT_W - imgW - 4;
        const textX = LEFT_MARGIN + imgW + 4;

        // Card shadow strip
        setFillColor([226, 232, 240]);
        doc.rect(LEFT_MARGIN + 0.8, atY + 0.8, CONTENT_W, cardH, 'F');

        // Card bg
        setFillColor([255, 255, 255]);
        doc.rect(LEFT_MARGIN, atY, CONTENT_W, cardH, 'F');

        // Festival amber border
        if (isFestival) {
          setColor([251, 191, 36]);
          doc.setLineWidth(0.7);
          doc.rect(LEFT_MARGIN, atY, CONTENT_W, cardH, 'S');
        }

        // Image
        await renderImage(LEFT_MARGIN, atY, imgW, cardH, post);
        drawTypeChip(LEFT_MARGIN, atY, post.type || 'PHOTO');

        // Text block
        let ty = atY + 5;

        // Headline
        const titleObj = getCleanTitle(post.title, postIndex);
        const titleLines = doc.splitTextToSize(titleObj.text, textW);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        if (!titleObj.isValid) doc.setTextColor(220, 38, 38); else setColor(colors.text);
        doc.text(titleLines.slice(0, 3), textX, ty);
        ty += (Math.min(titleLines.length, 3) * 5.2) + 2;

        // Status pills row
        const cSS = getStatusStyle(post.contentStatus);
        const dSS = getStatusStyle(post.status);
        let px = textX;
        px += drawBadge(px, ty, `C: ${cSS.label}`, cSS.bg, cSS.text);
        px += drawBadge(px, ty, `D: ${dSS.label}`, dSS.bg, dSS.text);
        if (isFestival) drawBadge(px, ty, cleanText(post.festival.name).toUpperCase(), [254, 243, 199], [217, 119, 6]);
        ty += 6;

        // Metadata row — muted, small
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        setColor(colors.secondary);
        let scheduledStr = 'Not scheduled';
        if (post.scheduledAt) scheduledStr = new Date(post.scheduledAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
        const createdByStr = cleanText(post.createdBy?.name || 'Unknown');
        const assignedToStr = post.assignedTo?.name ? cleanText(post.assignedTo.name) : 'Unassigned';
        doc.text(`\u{1F4C5} ${scheduledStr}   \u{1F464} ${createdByStr}   \u{27A1} ${assignedToStr}`, textX, ty);
        ty += 5;

        // Caption
        const captionObj = getCleanCaption(post.caption);
        const capLines = doc.splitTextToSize(captionObj.text, textW - 2);
        const maxCapLines = Math.min(capLines.length, 5);
        if (post.caption && captionObj.isValid) {
          setColor(colors.text);
        } else {
          setColor(colors.secondary);
        }
        doc.setFontSize(8);
        doc.setFont('helvetica', captionObj.isValid ? 'normal' : 'italic');
        doc.text(capLines.slice(0, maxCapLines), textX, ty);
        if (capLines.length > 5) {
          ty += maxCapLines * 3.5;
          setColor(colors.primary);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text('Read more…', textX, ty);
        }

        return atY + cardH + 6; // next Y
      };

      /** Render a GRID card: image-on-top ~50%, text below */
      const renderGridCard = async (post: any, postIndex: number, cardX: number, cardW: number, atY: number, cardH: number): Promise<void> => {
        const isFestival = !!post.festival;
        const imgH = Math.round(cardH * 0.52);


        // Shadow
        setFillColor([226, 232, 240]);
        doc.rect(cardX + 0.6, atY + 0.6, cardW, cardH, 'F');

        // Card bg
        setFillColor([255, 255, 255]);
        doc.rect(cardX, atY, cardW, cardH, 'F');

        if (isFestival) {
          setColor([251, 191, 36]);
          doc.setLineWidth(0.6);
          doc.rect(cardX, atY, cardW, cardH, 'S');
        }

        // Image on top
        await renderImage(cardX, atY, cardW, imgH, post);
        drawTypeChip(cardX, atY, post.type || 'PHOTO');

        // Status accent bar below image
        const dSS = getStatusStyle(post.status);
        setFillColor(dSS.text);
        doc.rect(cardX, atY + imgH, cardW, 1.2, 'F');

        // Text block
        const textX = cardX + 3;
        const textW = cardW - 6;
        let ty = atY + imgH + 4;

        // Title
        const titleObj = getCleanTitle(post.title, postIndex);
        const titleLines = doc.splitTextToSize(titleObj.text, textW);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        if (!titleObj.isValid) doc.setTextColor(220, 38, 38); else setColor(colors.text);
        doc.text(titleLines.slice(0, 2), textX, ty);
        ty += (Math.min(titleLines.length, 2) * 3.8) + 2;

        // Pills
        const cSS = getStatusStyle(post.contentStatus);
        let px = textX;
        px += drawBadge(px, ty, `C: ${cSS.label}`, cSS.bg, cSS.text);
        drawBadge(px, ty, `D: ${dSS.label}`, dSS.bg, dSS.text);
        ty += 5.5;

        // Date + Author metadata
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        setColor(colors.secondary);
        let scheduledStr = 'Not scheduled';
        if (post.scheduledAt) scheduledStr = new Date(post.scheduledAt).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
        doc.text(`${scheduledStr}  \u{1F464} ${cleanText(post.createdBy?.name || '?')}`, textX, ty);
        ty += 4;

        // Caption (truncated)
        const captionObj = getCleanCaption(post.caption);
        if (post.caption) {
          const capLines = doc.splitTextToSize(captionObj.text, textW);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', captionObj.isValid ? 'normal' : 'italic');
          if (captionObj.isValid) setColor(colors.text); else setColor(colors.secondary);
          doc.text(capLines.slice(0, 3), textX, ty);
          if (capLines.length > 3) {
            ty += 3 * 3.2;
            setColor(colors.primary);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text('Read more…', textX, ty);
          }
        }
      };

      // ─── RENDER POSTS IN MAGAZINE LAYOUT ────────────────────────────────────

      // Group posts by week for wayfinding labels
      const getWeekLabel = (dateStr: string | null): string => {
        if (!dateStr) return `Week of — `;
        const d = new Date(dateStr);
        // Find Monday of that week
        const day = d.getUTCDay(); // 0=Sun
        const diff = (day === 0 ? -6 : 1 - day);
        const mon = new Date(d);
        mon.setUTCDate(d.getUTCDate() + diff);
        return `Week of ${mon.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`;
      };

      let lastWeekLabel = '';
      let pendingGridPosts: { post: any; postIndex: number }[] = [];
      const GRID_CARD_H = 80;  // height of each 2-col grid card
      const GRID_GAP = 5;
      const GRID_COL_W = (CONTENT_W - GRID_GAP) / 2;

      const flushGridRow = async () => {
        if (pendingGridPosts.length === 0) return;
        // Need enough room for one grid row
        y = reserveHeight(GRID_CARD_H + 4, y);
        for (let gi = 0; gi < pendingGridPosts.length; gi++) {
          const colX = LEFT_MARGIN + gi * (GRID_COL_W + GRID_GAP);
          await renderGridCard(
            pendingGridPosts[gi].post,
            pendingGridPosts[gi].postIndex,
            colX, GRID_COL_W, y, GRID_CARD_H
          );
        }
        y += GRID_CARD_H + 5;
        pendingGridPosts = [];
      };

      // Track whether we've already rendered the hero on the current page
      let heroRenderedOnCurrentPage = false;

      for (let i = 0; i < projectData.posts.length; i++) {
        const post = projectData.posts[i];

        // Week wayfinding label
        const weekLabel = getWeekLabel(post.scheduledAt || post.createdAt);
        if (weekLabel !== lastWeekLabel) {
          // Flush pending grid row before new week
          await flushGridRow();
          // Check room for label (7mm) + at least a hero (62mm) or grid row (80mm)
          y = reserveHeight(72, y);
          // Only print label if it actually changed
          if (weekLabel !== lastWeekLabel) {
            y = drawWeekLabel(weekLabel, y);
            lastWeekLabel = weekLabel;
            heroRenderedOnCurrentPage = false;
          }
        }

        if (!heroRenderedOnCurrentPage) {
          // Flush any pending grid posts first
          await flushGridRow();
          // Render hero
          y = reserveHeight(62 + 6, y);
          y = await renderHeroCard(post, i, y);
          heroRenderedOnCurrentPage = true;
        } else {
          // Queue for 2-column grid
          pendingGridPosts.push({ post, postIndex: i });
          if (pendingGridPosts.length === 2) {
            await flushGridRow();
          }
        }
      }

      // Flush any remaining grid posts
      await flushGridRow();

      addFooter();
      
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      resolve(pdfBuffer);
    } catch (error) {
      console.error('Error in generateProfessionalPDFCatalog:', error);
      reject(error);
    }
  });
}

function getStatusStyle(status: string): { bg: number[], text: number[], label: string } {
  const normStatus = (status || '').toUpperCase();
  switch (normStatus) {
    case 'APPROVED':
    case 'POSTED':
      return { bg: [240, 253, 244], text: [22, 163, 74], label: 'APPROVED' };
    case 'SCHEDULED':
      return { bg: [239, 246, 255], text: [37, 99, 235], label: 'SCHEDULED' };
    case 'REJECTED':
      return { bg: [254, 242, 242], text: [220, 38, 38], label: 'REJECTED' };
    case 'NEEDS_REVISION':
    case 'NEEDS_MINOR_CHANGE':
      return { bg: [254, 243, 199], text: [217, 119, 6], label: 'NEEDS CHANGE' };
    case 'PENDING_REVIEW':
    case 'SUBMITTED':
      return { bg: [245, 243, 255], text: [124, 58, 237], label: 'PENDING' };
    case 'DRAFT':
    default:
      return { bg: [241, 245, 249], text: [71, 85, 105], label: normStatus || 'DRAFT' };
  }
}

function getCleanTitle(title: string | undefined, index: number): { text: string, isValid: boolean } {
  const text = (title || '').trim();
  const lower = text.toLowerCase();
  if (!text || lower.startsWith('untitled') || lower === 'post') {
    return { text: `Untitled Post #${index + 1} (Title Required)`, isValid: false };
  }
  return { text, isValid: true };
}

function getCleanCaption(caption: string | undefined): { text: string, isValid: boolean } {
  const text = (caption || '').trim();
  const lower = text.toLowerCase();
  if (!text || text.length < 5 || lower === 'cap' || lower === 'ss' || lower === 'caption') {
    return { text: 'Caption not written', isValid: false };
  }
  return { text, isValid: true };
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}