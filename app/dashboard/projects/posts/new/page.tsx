import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PostForm } from "@/components/forms/post-form"

export default async function NewPostPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/auth/signin")
  }
  
  if (!["ADMIN", "Manager", "Team Lead", "Content Writer", "Social Media Manager","Designer"].includes(session.user.role)) {
    redirect("/dashboard")
  }
  
  const projectId = typeof resolvedSearchParams.projectId === 'string' ? resolvedSearchParams.projectId : undefined;
  
  let projects = []
  let designers = []
  
  try {
    // Fetch projects
    projects = await prisma.project.findMany({
      where: { isActive: true },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
        assignedUsers: {
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    })
  } catch (error) {
    console.error("Error fetching projects:", error)
  }
  
  try {
    // Fetch designers and video editors
    designers = await prisma.user.findMany({
      where: {
        role: {
          name: {
            in: ["Designer", "Video Editor", "Creative Executive(Design & Media)"],
          }
        }
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
        assignedProjects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })
  } catch (error) {
    console.error("Error fetching designers:", error)
  }
  
  // Format designers data
  const formattedDesigners = designers.map((user: any) => ({
    id: user.id.toString(),
    name: user.name || "Unknown",
    role: user.role?.name || "Designer",
    email: user.email || "",
    assignedProjects: user.assignedProjects
      ? user.assignedProjects.map((proj: any) => ({
          id: proj.id.toString(),
          name: proj.name || "Unknown",
        }))
      : [],
  }))
  
  // Format projects data
  const formattedProjects = projects.map((project: any) => ({
    id: project.id,
    name: project.name,
    client: {
      id: project.client.id,
      name: project.client.name,
      email: project.client.email,
      company: project.client.company,
    },
    assignedUsers: project.assignedUsers || [],
  }))
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create New Post</h1>
        <p className="text-gray-600">Design and schedule your social media content across platforms</p>
      </div>
      
      {formattedProjects.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No active projects found. You need at least one active project to create posts.
            <a href="/dashboard/projects" className="ml-2 text-yellow-900 underline hover:no-underline">
              Manage Projects
            </a>
          </p>
        </div>
      )}
      
      <PostForm 
        projects={formattedProjects} 
        designers={formattedDesigners}
        initialProjectId={projectId} 
      />
    </div>
  )
}
