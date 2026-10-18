import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { guardPage } from "@/lib/permissions/guard"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  
  /**
   * posts:create, not a list of role names.
   *
   * This redirected anyone whose role was not literally one of six names, so a role
   * granted posts:create in the permission matrix was bounced back to the dashboard.
   */
  const gate = await guardPage("posts", "create", "Content & Posts")
  if (!gate.ok) return gate.response
  
  const projectId = typeof resolvedSearchParams.projectId === 'string' ? resolvedSearchParams.projectId : undefined;
  
  let projects: any[] = []
  let designers: any[] = []
  
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Create New Post"
        description="Design and schedule multi-platform content assets, captions, and creative deliverables."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/projects/posts">
            <ArrowLeft className="size-3.5" />
            Back to Posts
          </Link>
        </Button>
      </PageHeader>
      
      {formattedProjects.length === 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-xs">
            No active campaigns found. You need at least one active project to publish deliverables.
            <Link href="/dashboard/projects/new" className="ml-2 font-medium underline hover:no-underline">
              Create Campaign
            </Link>
          </AlertDescription>
        </Alert>
      )}
      
      <PostForm 
        projects={formattedProjects} 
        designers={formattedDesigners}
        initialProjectId={projectId} 
      />
    </div>
  )
}
