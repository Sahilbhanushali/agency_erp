import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireCan } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCan("credentials", "create");
    if (!auth.ok) return auth.response;
    const session = auth.session as any;
    const data = await request.json();

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data format. Expected an array." }, { status: 400 });
    }

    const createdCredentials = [];
    const errors = [];

    // Fetch all clients and projects into memory for fuzzy matching
    const allClients = await prisma.client.findMany({
      include: { projects: true }
    });

    const normalizeString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

    const fuzzyMatchClient = (name: string) => {
      const norm = normalizeString(name);
      // 1. Exact case-insensitive match
      let match = allClients.find((c: any) => c.name.toLowerCase() === name.toLowerCase());
      if (match) return match;
      // 2. Normalized match (ignore spaces/special chars)
      match = allClients.find((c: any) => normalizeString(c.name) === norm);
      if (match) return match;
      // 3. Substring match
      match = allClients.find((c: any) => normalizeString(c.name).includes(norm) || norm.includes(normalizeString(c.name)));
      return match;
    };

    const fuzzyMatchProject = (client: any, name: string) => {
      const norm = normalizeString(name);
      const projects = client.projects;
      let match = projects.find((p: any) => p.name.toLowerCase() === name.toLowerCase());
      if (match) return match;
      match = projects.find((p: any) => normalizeString(p.name) === norm);
      if (match) return match;
      match = projects.find((p: any) => normalizeString(p.name).includes(norm) || norm.includes(normalizeString(p.name)));
      return match;
    };

    // The data should contain: Client Name, Project Name, Location, Contact Number, Platform, User Id, Password
    for (const row of data) {
      const clientName = row["Client Name"];
      const projectName = row["Project Name"];
      const location = row["Location"] || "";
      const platform = row["Platform"];
      const userId = row["User Id"] || row["User ID"];
      const password = row["Password"];

      if (!clientName || !projectName || !platform || !userId || !password) {
        errors.push(`Row skipped: Missing required fields (Client Name, Project Name, Platform, User Id, Password). Received: ${JSON.stringify(row)}`);
        continue;
      }

      // Look up Client ID with fuzzy matching
      const client = fuzzyMatchClient(clientName.toString());
      if (!client) {
        errors.push(`Row skipped: Could not find client matching '${clientName}'`);
        continue;
      }

      // Look up Project ID with fuzzy matching
      const project = fuzzyMatchProject(client, projectName.toString());
      if (!project) {
        errors.push(`Row skipped: Could not find project matching '${projectName}' for client '${client.name}'`);
        continue;
      }

      // We can upsert or create. Let's just create since it's a bulk import.
      const cred = await prisma.credential.create({
        data: {
          clientId: client.id,
          projectId: project.id,
          location: location.toString(),
          platform: platform.toString(),
          userId: userId.toString(),
          password: encrypt(password.toString()),
        }
      });
      
      createdCredentials.push(cred);
    }

    if (createdCredentials.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: "Failed to import any credentials", details: errors }, { status: 400 });
    }

    return NextResponse.json({ success: true, count: createdCredentials.length, errors }, { status: 201 });
  } catch (error: any) {
    console.error("Error in bulk import credentials:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
