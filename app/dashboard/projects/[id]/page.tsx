"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Search, Filter, Calendar, Users, BarChart3, TrendingUp, Clock, CheckCircle, Target, Image, Video, Film, Camera } from "lucide-react";
import { getMediaUrl } from "@/lib/utils";
import MediaPopup from "@/components/mediaPopup";

type Post = {
  id: string;
  title: string;
  caption: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  createdById: string;
  assignedToId: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
};

type Manager = {
  id: number;
  email: string;
  name: string;
  roleId?: number;
  avatar: string | null;
  password?: string;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  managerId: number;
  client: Client;
  manager: Manager;
  posts: Post[];
  postTypes: Record<string, number>; // Added postTypes
};

// Updated getPostTypeIcon to include all post types
const getPostTypeIcon = (type: string) => {
  const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
    reel: Film,
    story: Camera,
    video: Video,
    carousel: Image,
    photo: Image,
    article: BarChart3, // Kept for compatibility
  };
  return iconMap[type.toLowerCase()] || BarChart3; // Fallback to BarChart3
};

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedLogo, setSelectedLogo] = useState<{ url: string; filename: string; type: string } | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error("Failed to fetch project");
        const data = await res.json();
        setProject(data);
      } catch (err) {
        console.error(err);
        setProject(null);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchProject();
  }, [id]);

  // Calculate comprehensive project statistics
  const projectStats = useMemo(() => {
    if (!project) return null;

    const posts = project.posts;
    const total = posts.length;

    const statusCounts = posts.reduce(
      (acc, post) => {
        let status = post.status.toLowerCase();
        if (status === 'rejected') status = 'changes';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { draft: 0, submitted: 0, approved: 0, changes: 0, scheduled: 0, posted: 0 } as Record<string, number>
    );

    // Calculate post type statistics based on postTypes and posts
    const postTypeStats = Object.entries(project.postTypes).reduce(
      (acc, [type, planned]) => {
        const typeLower = type.toLowerCase();
        acc[typeLower] = {
          planned,
          completed: 0,
          created: 0, // Track created posts (all statuses)
          remaining: planned,
          progressPercentage: 0,
          status: "not-started",
          isPlanned: true, // Mark as planned type
        };
        return acc;
      },
      {} as Record<string, { planned: number; completed: number; created: number; remaining: number; progressPercentage: number; status: string; isPlanned: boolean }>
    );

    // Update stats based on created posts
    posts.forEach((post) => {
      const type = post.type.toLowerCase();
      if (!postTypeStats[type]) {
        // Handle unplanned post types (like PHOTO)
        postTypeStats[type] = {
          planned: 0,
          completed: 0,
          created: 0,
          remaining: 0,
          progressPercentage: 0,
          status: "not-started",
          isPlanned: false,
        };
      }
      postTypeStats[type].created += 1;
      if (post.status.toLowerCase() === "posted") {
        postTypeStats[type].completed += 1;
      }
      // Calculate remaining based on planned posts
      if (postTypeStats[type].isPlanned) {
        postTypeStats[type].remaining = Math.max(0, postTypeStats[type].planned - postTypeStats[type].created);
      }
      postTypeStats[type].progressPercentage =
        postTypeStats[type].planned > 0
          ? Math.round((postTypeStats[type].completed / postTypeStats[type].planned) * 100) || 0
          : 0;
      postTypeStats[type].status =
        postTypeStats[type].completed === postTypeStats[type].planned && postTypeStats[type].planned > 0
          ? "completed"
          : postTypeStats[type].completed > 0
          ? "in-progress"
          : "not-started";
    });

    const completionRate = total > 0 ? Math.round((statusCounts.posted / total) * 100) : 0;
    const approvalRate = total > 0 ? Math.round(((statusCounts.approved + statusCounts.posted) / total) * 100) : 0;

    const now = new Date();
    const scheduledToday = posts.filter(
      (post) => post.scheduledAt && new Date(post.scheduledAt).toDateString() === now.toDateString()
    ).length;

    const overduePosts = posts.filter(
      (post) => post.scheduledAt && new Date(post.scheduledAt) < now && post.status !== "POSTED"
    ).length;

    return {
      total,
      statusCounts,
      postTypeStats,
      completionRate,
      approvalRate,
      scheduledToday,
      overduePosts,
    };
  }, [project]);

  // Filter and sort posts
  const filteredAndSortedPosts = useMemo(() => {
    if (!project) return [];

    let filtered = project.posts.filter((post) => {
      const matchesSearch =
        !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.caption.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = !statusFilter || post.status === statusFilter;
      const matchesType = !typeFilter || post.type === typeFilter;

      const matchesDate = !dateFilter || (() => {
        const postDate = new Date(post.createdAt).toDateString();
        const filterDate = new Date(dateFilter).toDateString();
        return postDate === filterDate;
      })();

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });

    // Sort posts
    filtered.sort((a, b) => {
      let aValue = a[sortBy as keyof Post] as string;
      let bValue = b[sortBy as keyof Post] as string;

      if (sortBy.includes("At") || sortBy.includes("Date")) {
        aValue = new Date(aValue || "").getTime().toString();
        bValue = new Date(bValue || "").getTime().toString();
      }

      const comparison = aValue.localeCompare(bValue);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [project, searchQuery, statusFilter, dateFilter, typeFilter, sortBy, sortOrder]);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => {
    if (!project) return [];
    return [...new Set(project.posts.map((post) => post.status))];
  }, [project]);

  const uniqueTypes = useMemo(() => {
    if (!project) return [];
    return [...new Set(project.posts.map((post) => post.type))];
  }, [project]);

  const getStatusColor = (status: string) => {
    const colors = {
      DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
      SUBMITTED: "bg-blue-100 text-blue-700 border-blue-200",
      APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
      REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
      SCHEDULED: "bg-amber-100 text-amber-700 border-amber-200",
      POSTED: "bg-violet-100 text-violet-700 border-violet-200",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex items-center space-x-3 bg-white p-6 rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-lg font-medium text-slate-700">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Project Not Found</h2>
          <p className="text-slate-600">The requested project could not be located.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                {project.name}
              </h1>
              <p className="text-lg text-slate-600 mt-2 max-w-3xl">{project.description}</p>
            </div>
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                project.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {project.isActive ? "Active Project" : "Inactive Project"}
            </div>
          </div>
        </div>

        {/* Enhanced Dashboard Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Key Metrics Cards */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Posts</p>
                  <p className="text-3xl font-bold text-slate-900">{projectStats?.total || 0}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Completion Rate</p>
                  <p className="text-3xl font-bold text-emerald-600">{projectStats?.completionRate || 0}%</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Scheduled Today</p>
                  <p className="text-3xl font-bold text-amber-600">{projectStats?.scheduledToday || 0}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Overdue</p>
                  <p className="text-3xl font-bold text-rose-600">{projectStats?.overduePosts || 0}</p>
                </div>
                <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-slate-600" />
              Post Status Distribution
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(projectStats?.statusCounts || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <span className="text-sm font-medium text-slate-700 capitalize">{status}</span>
                  <span className="text-lg font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Distribution & Post Types Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-slate-600" />
              Status Distribution
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(projectStats?.statusCounts || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <span className="text-sm font-medium text-slate-700 capitalize">{status}</span>
                  <span className="text-lg font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Post Types Summary Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-slate-600" />
              Post Types Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-left">
                    <th className="pb-2 text-slate-600 font-medium">Type</th>
                    <th className="pb-2 text-slate-600 font-medium text-center">Planned</th>
                    <th className="pb-2 text-slate-600 font-medium text-center">Created</th>
                    <th className="pb-2 text-slate-600 font-medium text-center">Done</th>
                    <th className="pb-2 text-slate-600 font-medium text-center">Left</th>
                    <th className="pb-2 text-slate-600 font-medium text-center">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(projectStats?.postTypeStats || {}).map(([type, stats]: [string, any]) => {
                    const IconComponent = getPostTypeIcon(type);
                    return (
                      <tr key={type} className="hover:bg-slate-50">
                        <td className="py-3">
                          <div className="flex items-center space-x-2">
                            <IconComponent className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-slate-700">
                              {type}
                              {!stats.isPlanned && <span className="text-xs text-rose-500 ml-2">(Unplanned)</span>}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-center text-slate-900 font-semibold">{stats.planned}</td>
                        <td className="py-3 text-center text-slate-900 font-semibold">{stats.created}</td>
                        <td className="py-3 text-center">
                          <span className="text-emerald-600 font-semibold">{stats.completed}</span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`font-semibold ${stats.remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {stats.remaining}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-12 bg-slate-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  stats.status === "completed" ? "bg-emerald-500" : stats.status === "in-progress" ? "bg-blue-500" : "bg-slate-400"
                                }`}
                                style={{ width: `${Math.min(stats.progressPercentage, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium text-slate-600">{stats.progressPercentage}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.keys(projectStats?.postTypeStats || {}).length === 0 && (
                <div className="text-center py-8">
                  <Target className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No post types configured for this project</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Project Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Project Timeline</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-600">Start Date</p>
                <p className="text-slate-900">{new Date(project.startDate).toLocaleDateString('en-GB')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">End Date</p>
                <p className="text-slate-900">{project.endDate ? new Date(project.endDate).toLocaleDateString('en-GB') : "Not set"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Duration</p>
                <p className="text-slate-900">
                  {project.endDate
                    ? `${Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))} days`
                    : "Ongoing"}
                </p>
              </div>
            </div>
          </div>

          {/* Client Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Client Information</h3>
            {project.client ? (
              <div className="flex items-start space-x-3">
                <img
                  src={project.client.avatar ? getMediaUrl(project.client.avatar) : "/default-avatar.png"}
                  alt={project.client.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 cursor-pointer hover:opacity-80 hover:scale-105 transition-all"
                  onClick={() => {
                    if (project.client.avatar) {
                      setSelectedLogo({
                        url: getMediaUrl(project.client.avatar),
                        filename: project.client.avatar.split("/").pop() || `${project.client.name}.jpg`,
                        type: "image",
                      });
                    }
                  }}
                  title="Click to view full image"
                />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{project.client.name}</p>
                  <p className="text-sm text-slate-600">{project.client.company}</p>
                  <p className="text-sm text-slate-600">{project.client.email}</p>
                  <p className="text-sm text-slate-600">{project.client.phone}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No client assigned</p>
            )}
          </div>

          {/* Manager Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Project Manager</h3>
            {project.manager ? (
              <div className="flex items-start space-x-3">
                <img
                  src={project.manager.avatar ? getMediaUrl(project.manager.avatar) : "/default-avatar.png"}
                  alt={project.manager.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 cursor-pointer hover:opacity-80 hover:scale-105 transition-all"
                  onClick={() => {
                    if (project.manager.avatar) {
                      setSelectedLogo({
                        url: getMediaUrl(project.manager.avatar),
                        filename: project.manager.avatar.split("/").pop() || `${project.manager.name}.jpg`,
                        type: "image",
                      });
                    }
                  }}
                  title="Click to view full image"
                />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{project.manager.name}</p>
                  <p className="text-sm text-slate-600">{project.manager.roleId ? `Role ID: ${project.manager.roleId}` : "Role not specified"}</p>
                  <p className="text-sm text-slate-600">{project.manager.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No manager assigned</p>
            )}
          </div>
        </div>

        {/* Posts Section with Advanced Filtering */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Posts Management
              </h2>
              <p className="text-sm text-slate-600">
                Showing {filteredAndSortedPosts.length} of {project.posts.length} posts
              </p>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <input
                type="date"
                className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />

              <div className="flex gap-2">
                <select
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="createdAt">Created Date</option>
                  <option value="updatedAt">Updated Date</option>
                  <option value="scheduledAt">Posting Date</option>
                  <option value="title">Title</option>
                  <option value="status">Status</option>
                </select>
                <button
                  className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>

            {(searchQuery || statusFilter || dateFilter || typeFilter) && (
              <button
                className="mt-4 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("");
                  setDateFilter("");
                  setTypeFilter("");
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>

          <div className="p-6">
            {filteredAndSortedPosts.length === 0 ? (
              <div className="text-center py-12">
                <Filter className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No posts found</h3>
                <p className="text-slate-600">
                  {project.posts.length === 0
                    ? "No posts have been created for this project yet."
                    : "Try adjusting your search criteria or filters."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAndSortedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">{post.title}</h3>
                        <p className="text-slate-600 mb-3">{post.caption}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(post.status)}`}>
                        {post.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-700 mb-1">Type</p>
                        <p className="text-slate-600">{post.type}</p>
                      </div>

                      <div>
                        <p className="font-medium text-slate-700 mb-1">Created</p>
                        <p className="text-slate-600">{new Date(post.createdAt).toLocaleDateString('en-GB')}</p>
                      </div>

                      {post.scheduledAt && (
                        <div>
                          <p className="font-medium text-slate-700 mb-1">Posting Date</p>
                          <p className="text-slate-600">{new Date(post.scheduledAt).toLocaleString()}</p>
                        </div>
                      )}

                      {post.postedAt && (
                        <div>
                          <p className="font-medium text-slate-700 mb-1">Posted</p>
                          <p className="text-slate-600">{new Date(post.postedAt).toLocaleString()}</p>
                        </div>
                      )}

                      <div>
                        <p className="font-medium text-slate-700 mb-1">Assigned To</p>
                        <p className="text-slate-600">{post.assignedToId}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MediaPopup
        isOpen={!!selectedLogo}
        onClose={() => setSelectedLogo(null)}
        asset={selectedLogo}
      />
    </div>
  );
}