import { NextResponse } from "next/server";
import ExcelJS from 'exceljs';
import { prisma } from "@/lib/prisma";
import { requireCan, requireSession } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireCan("posts", "read");
  if (!auth.ok) return auth.response;

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Posts Template");
    const dataSheet = workbook.addWorksheet("Data", { state: 'hidden' });

    // 1. Fetch Designers
    const designers = await prisma.user.findMany({
      where: {
        role: {
          name: {
            in: ["DESIGNER", "VIDEO EDITOR", "Creative Executive(Design & Media)", "Designer", "Video Editor", "Video editor", "designer"],
          },
        },
      },
      select: { name: true },
    });
    const designerNames = designers.map((d: any) => d.name).filter(Boolean);

    // 2. Populate Data Sheet for Dropdowns
    if (designerNames.length > 0) {
      designerNames.forEach((name: string, index: number) => {
        dataSheet.getCell(`A${index + 1}`).value = name;
      });
    } else {
      dataSheet.getCell('A1').value = 'No designers found';
    }

    const contentTypes = ['PHOTO', 'REEL', 'STORY', 'CAROUSEL', 'CUSTOM'];
    contentTypes.forEach((type, index) => {
      dataSheet.getCell(`B${index + 1}`).value = type;
    });

    const platforms = ['INSTAGRAM', 'FACEBOOK', 'TWITTER', 'LINKEDIN', 'THREADS', 'YOUTUBE', 'IGTV', 'GMB'];
    platforms.forEach((plat, index) => {
      dataSheet.getCell(`C${index + 1}`).value = plat;
    });

    // 3. Define Columns for Template
    worksheet.columns = [
      { header: "Sr. No.", key: "sr", width: 8 },
      { header: "Due Date (DD/MM/YY)", key: "dueDate", width: 15 },
      { header: "Posting Date (DD/MM/YY)", key: "postingDate", width: 15 },
      { header: "Content Type", key: "contentType", width: 15 },
      { header: "Title/Topic", key: "title", width: 30 },
      { header: "Writeup", key: "writeup", width: 45 },
      { header: "Visual Direction", key: "visualDir", width: 45 },
      { header: "Additional Note", key: "note", width: 30 },
      { header: "Approved Image Link", key: "imageLink", width: 25 },
      { header: "Caption", key: "caption", width: 45 },
      { header: "Hashtags", key: "hashtags", width: 30 },
      { header: "Keyword", key: "keyword", width: 15 },
      { header: "Internal Ref", key: "ref", width: 25 },
      { header: "Assigned Designer", key: "designer", width: 20 },
      { header: "Platforms", key: "platforms", width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' }
    };

    // 4. Add Sample Rows
    const currentYear = new Date().getFullYear().toString().slice(-2);
    
    worksheet.addRow({
      sr: 1,
      dueDate: `12/07/${currentYear}`,
      postingDate: `15/07/${currentYear}`,
      contentType: "REEL",
      title: "Blooming Nest Launch - Summer vibes",
      writeup: "We are officially open! Come check out our cozy spaces.",
      visualDir: "Show a dynamic video transitioning from empty rooms to styled spaces.",
      note: "Use warm natural tones and highlight the green accents.",
      imageLink: "",
      caption: "Welcome to our new space! We can't wait to host you.",
      hashtags: "#homedecor #cozydecor #launchday",
      keyword: "",
      ref: "",
      designer: designerNames.length > 0 ? designerNames[0] : "Jimmy Patel",
      platforms: "INSTAGRAM, FACEBOOK"
    });

    worksheet.addRow({
      sr: 2,
      dueDate: `14/07/${currentYear}`,
      postingDate: `16/07/${currentYear}`,
      contentType: "PHOTO",
      title: "5 Styling Tips for Corners",
      writeup: "Here are some easy tips to transform any dull corner.",
      visualDir: "High quality photo of a styled corner with a plant and armchair.",
      note: "Focus on minimalistic styling.",
      imageLink: "",
      caption: "A simple corner styling guide. Save this post for inspiration!",
      hashtags: "#styling #interiorstyling #tips",
      keyword: "",
      ref: "",
      designer: designerNames.length > 1 ? designerNames[1] : (designerNames[0] || "Ravi Shah"),
      platforms: "INSTAGRAM, FACEBOOK, LINKEDIN"
    });

    worksheet.addRow({
      sr: 3,
      dueDate: `16/07/${currentYear}`,
      postingDate: `18/07/${currentYear}`,
      contentType: "STORY",
      title: "Behind the Scenes",
      writeup: "A quick look at our team preparing for the big event.",
      visualDir: "Candid video of the team.",
      note: "Keep it authentic and natural.",
      imageLink: "drive.google.com/open?id=12345",
      caption: "Sneak peek of what's coming! 👀",
      hashtags: "#bts #teamwork",
      keyword: "",
      ref: "",
      designer: designerNames.length > 2 ? designerNames[2] : (designerNames[0] || "Jane Doe"),
      platforms: "INSTAGRAM"
    });

    worksheet.addRow({
      sr: 4,
      dueDate: `18/07/${currentYear}`,
      postingDate: `20/07/${currentYear}`,
      contentType: "CAROUSEL",
      title: "Client Testimonials",
      writeup: "Highlighting our recent positive reviews.",
      visualDir: "Clean, text-heavy graphics with brand colors.",
      note: "Use the new brand font.",
      imageLink: "",
      caption: "Our clients say it best! Swipe to see their stories.",
      hashtags: "#testimonials #happyclients",
      keyword: "",
      ref: "https://example.com/inspiration-board",
      designer: designerNames.length > 0 ? designerNames[0] : "Jimmy Patel",
      platforms: "LINKEDIN, FACEBOOK"
    });

    // 5. Apply Data Validation (Dropdowns) for 1000 rows
    for (let i = 2; i <= 1000; i++) {
      // Date Columns (Columns B and C)
      worksheet.getCell(`B${i}`).numFmt = '@';
      worksheet.getCell(`C${i}`).numFmt = '@';

      // Content Type (Column D)
      worksheet.getCell(`D${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Data!$B$1:$B$${contentTypes.length}`],
        showErrorMessage: true,
        errorTitle: 'Invalid Type',
        error: 'Please select a valid content type from the list.'
      };

      // Assigned Designer (Column N)
      worksheet.getCell(`N${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Data!$A$1:$A$${Math.max(1, designerNames.length)}`],
        showErrorMessage: false // Allow manual entry for multiples
      };

      // Platforms (Column O)
      worksheet.getCell(`O${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Data!$C$1:$C$${platforms.length}`],
        showErrorMessage: false // Allow manual entry for multiples
      };
    }

    // 6. Write to Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="bulk_posts_import_sample.xlsx"',
      },
    });
  } catch (error: any) {
    console.error("Error generating bulk import sample sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate sample sheet", details: error.message },
      { status: 500 }
    );
  }
}
