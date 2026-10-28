// app/api/posts/bulk/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Platform } from "@prisma/client";
import * as XLSX from 'xlsx';
import { requireCan } from "@/lib/api-auth";

type PostType = 'PHOTO' | 'REEL' | 'STORY' | 'CAROUSEL' | 'CUSTOM' | 'UNKNOWN';
type PostStatus = 'DRAFT' | 'POSTED';

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return ((maxLen - distance) / maxLen) * 100;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("posts", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session;
    // Uncomment when you want role-check again
    // if (!['ADMIN', 'Manager'].includes(session.user.role)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clientId = formData.get('clientId')?.toString();
    const projectId = formData.get('projectId')?.toString();

    console.log('📥 BULK IMPORT STARTED');
    console.log('File:', file?.name);
    console.log('Client ID:', clientId);
    console.log('Project ID:', projectId);

    // ---------- VALIDATIONS ----------
    if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });
    if (!clientId) return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: 'Invalid client' }, { status: 400 });

    // ---------- GET PROJECT ----------
    let project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    } else {
      console.log('✅ Project found:', project.name);
      if (project.clientId !== clientId) {
        return NextResponse.json({ error: 'Project does not belong to the selected client' }, { status: 400 });
      }
    }

    // ---------- FETCH DESIGNERS FOR FUZZY MATCHING ----------
const designers = await prisma.user.findMany({
  where: {
    role: {
      name: {
        in: [
          "DESIGNER",
          "VIDEO EDITOR",
          "Creative Executive(Design & Media)",
        ],
      },
    },
  },
  select: {
    id: true,
    name: true,
  },
});

    console.log(`Found ${designers.length} designers for assignment`);

    // ---------- EXCEL PARSING ----------
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const createdPosts: any[] = [];

    console.log('\n📊 WORKBOOK INFO:');
    console.log('Sheet Names:', workbook.SheetNames);
    console.log('Active Sheet Index:', (workbook.Workbook?.Sheets?.[0] as any)?.index || 0);

    // Get the active sheet (first sheet or the one that was visible when file was saved)
    const activeSheetName = workbook.SheetNames[0];
    console.log(`\n📄 Processing Active Sheet: "${activeSheetName}"`);
    
    const worksheet = workbook.Sheets[activeSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false, raw: false });
    
    console.log(`Total rows in sheet: ${rows.length}`);

    // Find header row
    let headerRow = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (row[0]?.toString().trim() === 'Sr. No.' || row[1]?.toString().trim() === 'Sr. No.') {
        headerRow = i;
        console.log(`✅ Header row found at index: ${i}`);
        console.log('Header columns:', row);
        break;
      }
    }
    
    if (headerRow === -1) {
      console.log('⚠️  No header row found');
      return NextResponse.json({ error: 'No header row found in the active sheet' }, { status: 400 });
    }

    let processedCount = 0;
    let skippedCount = 0;

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] as any[];
      
      // Skip empty rows
      if (!row[0] && !row[1]) {
        skippedCount++;
        continue;
      }

      console.log(`\n--- Row ${i} ---`);
      console.log('Raw row data:', row);

      const dueDateStr = row[1]?.toString().trim();
      const postingDateStr = row[2]?.toString().trim();
      const contentType = row[3]?.toString().trim() || '';
      const titleTopic = row[4]?.toString().trim() || '';
      const writeup = row[5]?.toString().trim() || '';
      const visualDir = row[6]?.toString().trim() || '';
      const additionalNote = row[7]?.toString().trim() || '';
      const approvedImage = row[8]?.toString().trim() || '';
      const caption = row[9]?.toString().trim() || '';
      const hashtags = row[10]?.toString().trim() || '';
      const keyword = row[11]?.toString().trim() || '';
      const internalRef = row[12]?.toString().trim() || '';
      const assignedDesignerName = row[13]?.toString().trim() || '';
      const platformsStr = row[14]?.toString().trim() || '';

      console.log('Parsed data:', {
        dueDateStr,
        postingDateStr,
        contentType,
        titleTopic,
        writeup: writeup.substring(0, 50) + '...',
        visualDir,
        additionalNote: additionalNote.substring(0, 50) + '...',
        approvedImage,
        caption: caption.substring(0, 50) + '...',
        hashtags,
        keyword,
        internalRef,
        assignedDesignerName,
        platformsStr
      });

      let postType: PostType = 'UNKNOWN';
      const typeLower = contentType.toLowerCase();
      if (typeLower.includes('reel') || typeLower.includes('video')) postType = 'REEL';
      else if (typeLower.includes('story')) postType = 'STORY';
      else if (typeLower.includes('carousel')) postType = 'CAROUSEL';
      else if (typeLower.includes('post') || typeLower.includes('static') || typeLower.includes('photo') || typeLower.includes('image')) postType = 'PHOTO';

      console.log('Determined post type:', postType);

      // Helper to parse dates
      const parseDateStr = (dateStr: string | undefined | number): Date | null => {
        if (!dateStr) return null;
        dateStr = dateStr.toString().trim();
        
        // Handle Excel numeric date format
        if (!isNaN(Number(dateStr)) && dateStr !== '') {
          const excelDate = Number(dateStr);
          const base = new Date(1899, 11, 30);
          return new Date(base.getTime() + excelDate * 86400000);
        }

        // Try to parse explicit DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        const match = dateStr.match(/^(\d{1,2})[/\-.\s](\d{1,2})[/\-.\s](\d{2,4})$/);
        if (match) {
          let day = parseInt(match[1], 10);
          let month = parseInt(match[2], 10);
          let year = parseInt(match[3], 10);
          
          if (year < 100) year += 2000;
          
          // First is ALWAYS day, Second is ALWAYS month
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
             return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
          }
          // If somehow they swapped and wrote MM/DD, try to salvage
          if (day >= 1 && day <= 12 && month >= 1 && month <= 31) {
             return new Date(Date.UTC(year, day - 1, month, 12, 0, 0));
          }
        }
        
        const match2 = dateStr.match(/^(\d{1,2})[/\-.\s](\d{1,2})$/);
        if (match2) {
          let day = parseInt(match2[1], 10);
          let month = parseInt(match2[2], 10);
          const currentYear = new Date().getFullYear();
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return new Date(Date.UTC(currentYear, month - 1, day, 12, 0, 0));
          }
        }

        // Final fallback
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }

        return null;
      };

      // ----- Dates -----
      let designDueDate: Date | null = parseDateStr(dueDateStr);
      let scheduledAt: Date | null = parseDateStr(postingDateStr);

      if (designDueDate) console.log('Parsed Due Date:', designDueDate.toISOString());
      if (scheduledAt) console.log('Parsed Posting Date:', scheduledAt.toISOString());
      
      // Fallback: If no valid posting date, use current date
      if (!scheduledAt) {
        scheduledAt = new Date();
        console.log('⚠️ No valid posting date; defaulting to current date:', scheduledAt.toISOString());
      }

      // Clean caption: Avoid 'N/A' junk
      const cleanCaption = caption === 'N/A' ? '' : caption;
      const cleanHashtags = hashtags === 'N/A' ? '' : hashtags;
      const fullCaption = `${cleanCaption} ${cleanHashtags}`.trim();
      const refUrl = internalRef || approvedImage || null;
      const status: PostStatus = 'DRAFT';

      console.log('Status:', status, '| Scheduled:', scheduledAt);

      // ----- Festival -----
      let festivalId: number | null = null;
      if (typeLower.includes('festive')) {
        const festName = titleTopic.split('-')[1]?.trim() || titleTopic.split(' - ')[1]?.trim() || '';
        console.log('Festival detected:', festName);
        
        if (festName) {
          let festival = await prisma.festival.findFirst({
            where: { name: { equals: festName } },
          });
          if (!festival) {
            console.log('Creating new festival:', festName);
            festival = await prisma.festival.create({
              data: {
                name: festName,
                description: 'Imported from bulk strategy',
                date: scheduledAt || new Date(),
                primaryType: postType,
              },
            });
          } else {
            console.log('Festival already exists:', festival.id);
          }
          festivalId = festival.id;
        }
      }

      // ----- Assigned Designer (with fuzzy matching) -----
      const assignedUserIds: number[] = [];
      let primaryAssignedToId: number | null = null;

      if (assignedDesignerName) {
        const designerNames = assignedDesignerName.split(',').map((n: string) => n.trim()).filter(Boolean);
        
        for (const dName of designerNames) {
          let bestMatch: any = null;
          let bestScore = 0;
          designers.forEach((d: any) => {
            const dNameLower = dName.toLowerCase();
            const fullNameLower = d.name.toLowerCase();
            let score = 0;
            
            // If the input name is a direct substring of the full name (e.g., "jimmy" in "jimmy patel")
            if (fullNameLower.includes(dNameLower)) {
              score = 100;
            } else {
              score = getSimilarity(dName, d.name);
            }

            if (score > bestScore && score > 80) { // Threshold for match
              bestScore = score;
              bestMatch = d;
            }
          });
          if (bestMatch) {
            const matchId = parseInt(bestMatch.id.toString(), 10);
            if (!assignedUserIds.includes(matchId)) {
              assignedUserIds.push(matchId);
            }
            if (primaryAssignedToId === null) {
              primaryAssignedToId = matchId;
            }
            console.log(`✅ Assigned to designer: "${bestMatch.name}" (fuzzy score: ${bestScore.toFixed(1)}%) for input: "${dName}"`);
          } else {
            console.warn(`⚠️ No designer found matching "${dName}" (tried fuzzy match with threshold 80%)`);
          }
        }
      }

      // ----- Platforms -----
      const validPlatforms: Platform[] = [];
      if (platformsStr) {
        const platformList = platformsStr.split(',').map((p: string) => p.trim().toUpperCase());
        const platformEnum = Object.values(Platform);
        platformList.forEach((p: string) => {
          if (platformEnum.includes(p as Platform)) {
            validPlatforms.push(p as Platform);
          } else {
            console.warn('⚠️  Invalid platform:', p);
          }
        });
      }
      if (validPlatforms.length === 0) {
        // Fallback to defaults if none specified
        validPlatforms.push('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'THREADS', 'GMB');
        console.log('No valid platforms specified; using defaults');
      }
      console.log('Parsed platforms:', validPlatforms);

      const title = titleTopic || `Untitled Post ${i}`;
      const notes = [visualDir, additionalNote].filter(Boolean).join(' | ').trim() || null;
      
      console.log('Creating post:', title);
      
      const approvalFlowsData: any[] = [
        {
          flowType: 'CONTENT',
          status: 'APPROVED',
          submissionCount: 1,
          version: 1,
          submittedById: parseInt(session.user.id, 10),
          submittedAt: new Date(),
          reviewedById: parseInt(session.user.id, 10),
          reviewedAt: new Date(),
        },
      ];
      if (assignedUserIds.length > 0) {
        assignedUserIds.forEach(id => {
          approvalFlowsData.push({
            flowType: 'DESIGN',
            status: 'PENDING',
            submissionCount: 0,
            version: 1,
            assignedToId: id,
          });
        });
      }

      const newPost = await prisma.post.create({
        data: {
          title,
          caption: fullCaption || null,
          type: postType,
          status,
          contentStatus: 'APPROVED',
          projectId: project.id,
          createdById: parseInt(session.user.id, 10),
          assignedToId: primaryAssignedToId,
          assignedUsers: assignedUserIds.length > 0 ? {
            connect: assignedUserIds.map(id => ({ id }))
          } : undefined,
          designDueDate,
          scheduledAt,
          writeUp: writeup,
          notes,
          referenceUrl: refUrl,
          festivalId,
          keyword,
          platforms: { create: validPlatforms.map(platform => ({ platform })) },
          approvalFlows: {
            create: approvalFlowsData,
          },
        },
      });

      console.log('✅ Post created with ID:', newPost.id);

      // ----- Task Log -----
      await prisma.taskLog.create({
        data: {
          action: 'CREATE',
          newStatus: newPost.status,
          newValues: JSON.parse(JSON.stringify(newPost)),
          postId: newPost.id,
          userId: parseInt(session.user.id, 10),
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });

      // ----- Approval History -----
      const flows = await prisma.approvalFlow.findMany({
        where: { postId: newPost.id },
      });
      for (const flow of flows) {
        await prisma.approvalHistory.create({
          data: {
            action: flow.status === 'APPROVED' ? 'APPROVED' : (flow.status === 'SUBMITTED' ? 'SUBMITTED' : 'ASSIGNED'),
            fromStatus: null,
            toStatus: flow.status,
            version: flow.version,
            metadata: { bulkImport: true },
            approvalFlowId: flow.id,
            performedById: parseInt(session.user.id, 10),
          },
        });
      }

      createdPosts.push(newPost);
      processedCount++;
    }

    console.log(`\n📊 Sheet "${activeSheetName}" Summary:`);
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);

    console.log('\n🎉 BULK IMPORT COMPLETED');
    console.log(`Total posts created: ${createdPosts.length}`);

    return NextResponse.json({
      success: true,
      message: `Bulk import completed: ${createdPosts.length} posts created`,
      projectId: project.id,
      projectName: project.name,
      client: client.name,
      count: createdPosts.length,
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ BULK IMPORT ERROR:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Import failed', details: error.message },
      { status: 500 }
    );
  }
}