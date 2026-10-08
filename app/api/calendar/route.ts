import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PostPlatform } from "@prisma/client";

// Define types for clarity and type safety
interface User {
  id: string;
  email: string;
  role: "Client" | "Designer" | "ADMIN" | "Manager";
  name?: string;
  showPostingCalendar: boolean;
}

interface Post {
  id: string;
  scheduledAt: string | null;
  designDueDate?: string | null;
  project: {
    id: string;
    name: string;
    client: { id: string; email: string; name?: string } | null;
  } | null;
  createdBy: { id: string; email: string; name?: string } | null;
  platforms: PostPlatform[];
}

interface Project {
  id: string;
  name: string;
  isActive: boolean;
  client: { id: string; email: string; name?: string } | null;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Log session data for debugging
  console.log("Session user:", {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email,
  });

  // Validate user ID
  const userId = session.user.id ? parseInt(session.user.id) : null;
  if (!userId || isNaN(userId)) {
    console.log("Invalid user ID:", session.user.id);
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Normalize role to match interface
  const normalizedRole = session.user.role

  // Define whereClause based on user role
  const isFullAccess = ["admin", "manager", "team lead", "social media manager"].includes(
    normalizedRole?.toLowerCase() || ""
  );

  let whereClause: any = {};
  if (normalizedRole?.toLowerCase() === "client") {
    whereClause = { project: { client: { email: session.user.email ?? "" } } };
  } else if (!isFullAccess) {
    whereClause = {
      OR: [
        { assignedToId: userId },
        { assignedUsers: { some: { id: userId } } },
        { assignments: { some: { userId: userId } } },
      ],
    };
  }

  // Log whereClause for debugging
  console.log("Where clause:", whereClause);

  // Fetch posts with scheduled dates
  const postsRaw = await prisma.post.findMany({
    where: {
      AND: [
        Object.keys(whereClause).length > 0 ? whereClause : {},
        { project: { isActive: true } },
        {
          OR: [
            { scheduledAt: { not: null } },
            { designDueDate: { not: null } }
          ]
        }
      ]
    },
    include: {
      project: {
        include: { client: true },
      },
      createdBy: true,
      platforms: true,
    },
    orderBy: { scheduledAt: "asc" },
  });

  // Log raw posts for debugging
  console.log("Fetched posts:", postsRaw);

  // Serialize posts
  const posts = postsRaw.map((post: any) => ({
    ...post,
    scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : null,
    designDueDate: post.designDueDate ? post.designDueDate.toISOString() : null,
    project: post.project
      ? {
          ...post.project,
          client: post.project.client
            ? { ...post.project.client, name: post.project.client.name ?? "" }
            : null,
        }
      : null,
    createdBy: post.createdBy
      ? { ...post.createdBy, name: post.createdBy.name ?? "" }
      : null,
  }));

  // Fetch projects
  const projectsRaw = await prisma.project.findMany({
    where: { isActive: true },
    include: { client: true },
    orderBy: { name: "asc" },
  });

  // Serialize projects
  const projects = projectsRaw.map((project: any) => ({
    ...project,
    client: project.client
      ? { ...project.client, name: project.client.name ?? "" }
      : null,
  }));

  // Determine if user can see the Posting Date calendar
  // Only Designer and Video Editor roles are restricted to Design Date only
  const roleName = (session.user.role || "").toLowerCase();
  const showPostingCalendar = !roleName.includes("designer") && !roleName.includes("video");

  // Serialize currentUser
  const currentUser = {
    id: session.user.id ?? "",
    email: session.user.email ?? "",
    role: session.user.role as any,
    name: session.user.name ?? "",
    showPostingCalendar,
  };

  // Log response data for debugging
  console.log("Response data:", { postsCount: posts.length, projectsCount: projects.length });

  return NextResponse.json({ posts, projects, currentUser });
}