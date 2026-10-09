"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useSWR from "swr";
import { Toaster, toast } from "react-hot-toast";

type Festival = {
  id?: number;
  name: string;
  description: string;
  date: string;
  primaryType: string;
};

type Project = {
  id: string;
  name: string;
  client: {
    company: string;
  };
};

type FormErrors = {
  name?: string;
  description?: string;
  date?: string;
  primaryType?: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to fetch");
  }
  return res.json();
};

export default function FestivalsPage() {
  const { data: session, status } = useSession();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "calendar">("list");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [festivalDetailOpen, setFestivalDetailOpen] = useState(false);
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
  const [selectedProjectsByFestival, setSelectedProjectsByFestival] = useState<{ [key: number]: string[] }>({});
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: "",
    primaryType: "",
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);


  // Fetch current user's role with SWR
  const { data: userData, error: userError } = useSWR(
    status === "authenticated" && session?.user?.id ? `/api/users/role?id=${session.user.id}` : null,
    fetcher
  );

  // Fetch user role and permissions
  useEffect(() => {
    const fetchUserRoleAndPermissions = async () => {
      if (status === "loading" || !session?.user?.id) {
        setIsCheckingPermissions(false);
        return;
      }

      try {
        const userRes = await fetch(`/api/users/role?id=${session.user.id}`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!userRes.ok) {
          const errorData = await userRes.json();
          throw new Error(errorData.error || "Failed to fetch user role");
        }
        const userData = await userRes.json();
        setUserRole(userData.role || "CLIENT");

        if (userData.role) {
          const permRes = await fetch(`/api/role-permission/role/${userData.role}`, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (!permRes.ok) {
            const errorData = await permRes.json();
            throw new Error(errorData.error || "Failed to fetch permissions");
          }
          const permData = await permRes.json();
          console.log("Received permissions:", permData);
          const permissionStrings = Array.isArray(permData)
            ? permData.map((item: { permission: string }) => item.permission)
            : [];
          console.log("Extracted permission strings:", permissionStrings);
          setPermissions(permissionStrings);
        }
      } catch (error) {
        console.error("Error fetching user role/permissions:", error);
        setAuthError(error instanceof Error ? error.message : "Failed to load user permissions");
        toast.error(error instanceof Error ? error.message : "Failed to load user permissions");
      } finally {
        setIsCheckingPermissions(false);
      }
    };
    fetchUserRoleAndPermissions();
  }, [session, status]);

  // Fetch projects for dropdown
  const { data: projects, error: projectsError } = useSWR(
    userRole && (userRole === "ADMIN" || userRole === "Manager") ? "/api/projects" : null,
    fetcher
  );

  useEffect(() => {
    if (userData) {
      setUserRole(userData.role || "CLIENT");
    }
    if (userError) {
      console.error("Error fetching user role:", userError);
      setAuthError(userError.message || "Failed to load user role");
      toast.error(userError.message || "Failed to load user role"); // Show error toast
    }
  }, [userData, userError]);

  // Fetch festivals with SWR
  const { data: rawFestivals, error: festivalsError, mutate: mutateFestivals, isLoading: festivalsIsLoading } = useSWR(
    userRole ? "/api/festivals" : null,
    fetcher
  );

  useEffect(() => {
    console.log("Raw Festivals:", rawFestivals);
    if (rawFestivals) {
      if (!Array.isArray(rawFestivals)) {
        setFormErrors({ name: "Invalid festival data format: Expected an array" });
        toast.error("Invalid festival data format: Expected an array");
        return;
      }

      const filteredHolidays = rawFestivals
        .filter((holiday: Festival) => {
          const holidayDate = new Date(holiday.date);
          return holidayDate.getFullYear() === parseInt(selectedYear);
        })
        .sort((a: Festival, b: Festival) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

      console.log("Filtered Festivals:", filteredHolidays);
      setFestivals(filteredHolidays);
    }
    if (festivalsError) {
      console.error("Error fetching festivals:", festivalsError);
      setFormErrors({ name: festivalsError.message || "Failed to fetch festivals" });
      toast.error(festivalsError.message || "Failed to fetch festivals");
    }
    setLoading(festivalsIsLoading);
  }, [rawFestivals, festivalsError, festivalsIsLoading, selectedYear, userRole]);

  useEffect(() => {
    console.log("Selected Month Changed:", selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (viewMode === "calendar" && selectedMonth === null) {
      setSelectedMonth(currentMonth);
    }
  }, [viewMode, selectedMonth, currentMonth]);

  const validateForm = (data: typeof formData): FormErrors => {
    const errors: FormErrors = {};

    // Name validation
    if (!data.name.trim()) {
      errors.name = "Festival name is required";
    } else if (data.name.length < 3) {
      errors.name = "Name must be at least 3 characters long";
    } else if (data.name.length > 100) {
      errors.name = "Name cannot exceed 100 characters";
    }

    // Description validation
    if (!data.description.trim()) {
      errors.description = "Description is required";
    } else if (data.description.length < 10) {
      errors.description = "Description must be at least 10 characters long";
    } else if (data.description.length > 500) {
      errors.description = "Description cannot exceed 500 characters";
    }

    // Date validation
    if (!data.date) {
      errors.date = "Date is required";
    } else {
      const selectedDate = new Date(data.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(selectedDate.getTime())) {
        errors.date = "Invalid date format";
      } else if (selectedDate < today) {
        errors.date = "Date cannot be in the past";
      }
    }

    // Primary Type validation
    if (!data.primaryType) {
      errors.primaryType = "Primary type is required";
    }

    return errors;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { name: string; value: string }
  ) => {
    const { name, value } = "target" in e ? e.target : e;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear specific field error when user starts typing
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      Object.values(errors).forEach((error) => toast.error(error));
      return;
    }

    try {
      const response = await fetch("/api/festivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          date: formData.date,
          primaryType: formData.primaryType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add festival");
      }

      toast.success("Festival added successfully!");
      setFormData({ name: "", description: "", date: "", primaryType: "" });
      setFormOpen(false);
      mutateFestivals();
    } catch (error) {
      setFormErrors({ name: error instanceof Error ? error.message : "An error occurred" });
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      Object.values(errors).forEach((error) => toast.error(error));
      return;
    }

    try {
      const response = await fetch(`/api/festivals/${selectedFestival?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          date: formData.date,
          primaryType: formData.primaryType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update festival");
      }

      toast.success("Festival updated successfully!");
      setFormData({ name: "", description: "", date: "", primaryType: "" });
      setEditFormOpen(false);
      setSelectedFestival(null);
      mutateFestivals();
    } catch (error) {
      setFormErrors({ name: error instanceof Error ? error.message : "An error occurred" });
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleDelete = async () => {
    setFormErrors({});

    try {
      const response = await fetch(`/api/festivals/${selectedFestival?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete festival");
      }

      toast.success("Festival deleted successfully!");
      setDeleteDialogOpen(false);
      setFestivalDetailOpen(false);
      setSelectedFestival(null);
      setSelectedProjectsByFestival((prev) => {
        const updated = { ...prev };
        if (selectedFestival?.id) {
          delete updated[selectedFestival.id];
        }
        return updated;
      });
      mutateFestivals();
    } catch (error) {
      setFormErrors({ name: error instanceof Error ? error.message : "An error occurred" });
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleCreatePost = async (festival: Festival) => {
    const selectedProjects = festival.id ? selectedProjectsByFestival[festival.id] || [] : [];
    if (!selectedProjects.length) {
      setFormErrors({ name: "Please select at least one project" });
      toast.error("Please select at least one project");
      return;
    }
    setFormErrors({});

    try {
      const projectDetails = projects?.filter((p: Project) => selectedProjects.includes(p.id)) || [];
      const promises = projectDetails.map(async (project: any) => {
        const response = await fetch("/api/festival-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${project.client.company} - ${festival.name}`,
            caption: festival.description,
            type: "STORY",
            status: "DRAFT",
            contentStatus: "DRAFT",
            scheduledAt: festival.date,
            projectId: project.id,
            festivalId: festival.id,
            createdById: session?.user?.id,
            platforms: ["INSTAGRAM"],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to create post for project ${project.name}`);
        }
        return response.json();
      });

      await Promise.all(promises);
      toast.success(`Posts created successfully for ${festival.name}!`);
      if (festival.id) {
        setSelectedProjectsByFestival((prev) => ({
          ...prev,
          [festival.id!]: [],
        }));
      }
    } catch (error) {
      setFormErrors({ name: error instanceof Error ? error.message : "An error occurred" });
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleEdit = (festival: Festival) => {
    setSelectedFestival(festival);
    setFormData({
      name: festival.name,
      description: festival.description,
      date: festival.date.split("T")[0], // Ensure date is in YYYY-MM-DD format
      primaryType: festival.primaryType,
    });
    setEditFormOpen(true);
  };

  const handleFestivalClick = (festival: Festival) => {
    setSelectedFestival(festival);
    setFestivalDetailOpen(true);
  };

  const handleProjectSelection = (festivalId: number | undefined, projectId: string, checked: boolean) => {
    if (!festivalId) return;
    setSelectedProjectsByFestival((prev) => {
      const currentProjects = prev[festivalId] || [];
      if (checked) {
        return { ...prev, [festivalId]: [...currentProjects, projectId] };
      } else {
        return { ...prev, [festivalId]: currentProjects.filter((id) => id !== projectId) };
      }
    });
  };

  const years = Array.from({ length: parseInt(currentYear) - 1984 + 1 }, (_, i) => (1985 + i).toString());

  const months = [
    { value: 1, label: "Jan" },
    { value: 2, label: "Feb" },
    { value: 3, label: "Mar" },
    { value: 4, label: "Apr" },
    { value: 5, label: "May" },
    { value: 6, label: "Jun" },
    { value: 7, label: "Jul" },
    { value: 8, label: "Aug" },
    { value: 9, label: "Sep" },
    { value: 10, label: "Oct" },
    { value: 11, label: "Nov" },
    { value: 12, label: "Dec" },
  ];

  const formatFestivalDate = (date: string) => {
    const festivalDate = new Date(date);
    return `${festivalDate.toLocaleDateString('en-GB', {
      month: "long",
      day: "numeric",
    })}, ${festivalDate.getFullYear()}`;
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleString("default", { month: "long" });
  };

  const canManageFestivals = permissions.includes("Manage-festival");
  const canViewFestivals = permissions.includes("View-festivals");

  const displayedFestivals = useMemo(() => {
    console.log("Filtering festivals for year:", selectedYear, "month:", selectedMonth);
    return festivals.filter((f) => {
      const date = new Date(f.date);
      return date.getMonth() + 1 === selectedMonth && date.getFullYear() === parseInt(selectedYear);
    });
  }, [festivals, selectedMonth, selectedYear]);

  const upcomingFestivals = useMemo(() => {
    return festivals.filter((festival) => {
      const date = new Date(festival.date);
      return date.getMonth() + 1 > selectedMonth && date.getFullYear() === parseInt(selectedYear);
    });
  }, [festivals, selectedMonth, selectedYear]);

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear((parseInt(selectedYear) - 1).toString());
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear((parseInt(selectedYear) + 1).toString());
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const renderProjectSelector = (festivalId: number | undefined) => (
    <Popover modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-xs p-2"
          onClick={(e) => e.stopPropagation()}
        >
          Select Projects
          {festivalId && selectedProjectsByFestival[festivalId]?.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedProjectsByFestival[festivalId].length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-h-[200px] overflow-y-auto z-[1000]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          {projects?.map((project: Project) => (
            <div key={project.id} className="flex items-center space-x-2">
              <Checkbox
                id={`project-${festivalId}-${project.id}`}
                checked={festivalId ? selectedProjectsByFestival[festivalId]?.includes(project.id) : false}
                onCheckedChange={(checked: boolean) => handleProjectSelection(festivalId, project.id, checked)}
              />
              <label
                htmlFor={`project-${festivalId}-${project.id}`}
                className="text-sm text-gray-700 cursor-pointer flex-1"
              >
                {project.client.company} - {project.name}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const renderFestivalCard = (festival: Festival) => (
    <div key={festival.id} className="p-4 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center">
      <div className="flex-1">
        <h3 className="text-md font-medium">{festival.name}</h3>
        <p className="text-sm text-gray-600">{festival.description}</p>
        <p className="text-sm">📅 {formatFestivalDate(festival.date)}</p>
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
          {festival.primaryType}
        </span>
      </div>
      {canManageFestivals && (
        <div className="mt-4 sm:mt-0 sm:ml-4 flex flex-col space-y-2">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(festival)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedFestival(festival);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
          <div className="flex flex-col space-y-2">
            {renderProjectSelector(festival.id)}
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
              {festival.id && selectedProjectsByFestival[festival.id]?.map((projectId) => {
                const project = projects?.find((p: Project) => p.id === projectId);
                return project ? (
                  <div key={project.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`selected-project-${festival.id}-${project.id}`}
                      checked={true}
                      onCheckedChange={() => handleProjectSelection(festival.id, project.id, false)}
                    />
                    <label
                      htmlFor={`selected-project-${festival.id}-${project.id}`}
                      className="text-sm text-gray-700"
                    >
                      {project.client.company} - {project.name}
                    </label>
                  </div>
                ) : null;
              })}
            </div>
            <Button
              onClick={() => handleCreatePost(festival)}
              disabled={!festival.id || !selectedProjectsByFestival[festival.id]?.length}
            >
              Add to Posts
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderGridFestivalCard = (festival: Festival) => (
    <div key={festival.id} className="p-4 border rounded-lg">
      <h3 className="text-md font-medium">{festival.name}</h3>
      <p className="text-sm text-gray-600">{festival.description}</p>
      <p className="text-sm">📅 {formatFestivalDate(festival.date)}</p>
      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
        {festival.primaryType}
      </span>
      {canManageFestivals && (
        <div className="mt-2 flex flex-col space-y-2">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(festival)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedFestival(festival);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
          <div className="flex flex-col space-y-2">
            {renderProjectSelector(festival.id)}
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
              {festival.id && selectedProjectsByFestival[festival.id]?.map((projectId) => {
                const project = projects?.find((p: Project) => p.id === projectId);
                return project ? (
                  <div key={project.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`selected-project-${festival.id}-${project.id}`}
                      checked={true}
                      onCheckedChange={() => handleProjectSelection(festival.id, project.id, false)}
                    />
                    <label
                      htmlFor={`selected-project-${festival.id}-${project.id}`}
                      className="text-sm text-gray-700"
                    >
                      {project.client.company} - {project.name}
                    </label>
                  </div>
                ) : null;
              })}
            </div>
            <Button
              onClick={() => handleCreatePost(festival)}
              disabled={!festival.id || !selectedProjectsByFestival[festival.id]?.length}
            >
              Add to Posts
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const calendarGrid = useMemo(() => {
    console.log("Rendering calendar for month:", selectedMonth);
    const firstDay = new Date(parseInt(selectedYear), selectedMonth - 1, 1);
    const lastDay = new Date(parseInt(selectedYear), selectedMonth, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dayFestivals = displayedFestivals.filter(f => {
        const festivalDate = new Date(f.date);
        return festivalDate.toDateString() === current.toDateString();
      });

      const isCurrentMonth = current.getMonth() === selectedMonth - 1;
      const isToday = current.toDateString() === new Date().toDateString();

      days.push({
        date: new Date(current),
        festivals: dayFestivals,
        isCurrentMonth,
        isToday,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [selectedMonth, selectedYear, displayedFestivals]);

  const renderCalendarGrid = () => {
    return (
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <Button variant="ghost" size="sm" onClick={() => navigateMonth("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold">
            {getMonthName(selectedMonth)} {selectedYear}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigateMonth("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-700 bg-gray-50">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarGrid.map((day, index) => (
            <div
              key={index}
              className={`min-h-[120px] p-2 border-b border-r border-gray-200 ${
                !day.isCurrentMonth ? "bg-gray-50 text-gray-400" : ""
              } ${day.isToday ? "bg-blue-50" : ""}`}
            >
              <div
                className={`text-sm font-medium mb-1 ${
                  day.isToday ? "text-blue-600" : day.isCurrentMonth ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {day.date.getDate()}
              </div>
              <div className="space-y-1">
                {day.festivals.map((festival) => (
                  <div
                    key={festival.id}
                    className="text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity bg-blue-100 text-blue-800 border-l-2 border-blue-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFestivalClick(festival);
                    }}
                  >
                    <div className="font-medium truncate">{festival.name}</div>
                    <div className="text-[10px] opacity-75 truncate">{festival.primaryType}</div>
                    {canManageFestivals && (
                      <div className="mt-1">
                        {/* {renderProjectSelector(festival.id)} */}
                        <div className="border rounded-md p-2 max-h-40 overflow-y-auto mt-1">
                          {/* {festival.id &&
                            selectedProjectsByFestival[festival.id]?.map((projectId) => {
                              const project = projects?.find((p: Project) => p.id === projectId);
                              return project ? (
                                <div key={project.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`selected-project-${festival.id}-${project.id}`}
                                    checked={true}
                                    onCheckedChange={() =>
                                      handleProjectSelection(festival.id, project.id, false)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <label
                                    htmlFor={`selected-project-${festival.id}-${project.id}`}
                                    className="text-sm text-gray-700"
                                  >
                                    {project.client.companyName} - {project.name}
                                  </label>
                                </div>
                              ) : null;
                            })} */}
                        </div>
                        {/* <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreatePost(festival);
                          }}
                          disabled={!festival.id || !selectedProjectsByFestival[festival.id]?.length}
                          className="mt-1 w-full text-xs"
                        >
                          Add to Posts
                        </Button> */}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFestivals = () => {
    if (displayedFestivals.length === 0 && upcomingFestivals.length === 0) {
      return <p className="text-gray-600">No festivals found.</p>;
    }

    if (viewMode === "list") {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">
              Current & Past Festivals ({displayedFestivals.length})
            </h3>
            {displayedFestivals.length === 0 ? (
              <p className="text-gray-500">No current or past festivals this month.</p>
            ) : (
              <div className="space-y-4">
                {displayedFestivals.map(renderFestivalCard)}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-700">
              Upcoming Festivals ({upcomingFestivals.length})
            </h3>
            {upcomingFestivals.length === 0 ? (
              <p className="text-gray-500">No upcoming festivals this month.</p>
            ) : (
              <div className="space-y-4">
                {upcomingFestivals.map(renderFestivalCard)}
              </div>
            )}
          </div>
        </div>
      );
    } else if (viewMode === "grid") {
      return (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">
              Current & Past Festivals ({displayedFestivals.length})
            </h3>
            {displayedFestivals.length === 0 ? (
              <p className="text-gray-500">No current or past festivals this month.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedFestivals.map(renderGridFestivalCard)}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-700">
              Upcoming Festivals ({upcomingFestivals.length})
            </h3>
            {upcomingFestivals.length === 0 ? (
              <p className="text-gray-500">No upcoming festivals this month.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {upcomingFestivals.map(renderGridFestivalCard)}
              </div>
            )}
          </div>
        </div>
      );
    } else if (viewMode === "calendar") {
      return renderCalendarGrid();
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 lg:px-6">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} /> {/* Add Toaster component */}
      {status === "loading" ? (
        <p>Loading authentication...</p>
      ) : !session ? (
        <p className="text-red-600">Please sign in to view festivals.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 sm:gap-0">
            <h1 className="text-2xl font-bold">Festivals</h1>
            <div className="flex items-center space-x-4 w-full sm:w-auto justify-end">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canManageFestivals && (
                <Dialog open={formOpen} onOpenChange={setFormOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Festival
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Festival</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <Input
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Festival Name"
                          required
                          className={formErrors.name ? "border-red-500" : ""}
                        />
                        {formErrors.name && <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <Textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Festival Description"
                          required
                          className={formErrors.description ? "border-red-500" : ""}
                        />
                        {formErrors.description && <p className="text-red-600 text-sm mt-1">{formErrors.description}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date</label>
                        <Input
                          type="date"
                          name="date"
                          value={formData.date}
                          onChange={handleInputChange}
                          required
                          className={formErrors.date ? "border-red-500" : ""}
                        />
                        {formErrors.date && <p className="text-red-600 text-sm mt-1">{formErrors.date}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Primary Type</label>
                        <Select
                          value={formData.primaryType}
                          onValueChange={(value) => handleInputChange({ name: "primaryType", value })}
                        >
                          <SelectTrigger className={formErrors.primaryType ? "border-red-500" : ""}>
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="National Holiday">National Holiday</SelectItem>
                            <SelectItem value="Religious Holiday">Religious Holiday</SelectItem>
                            <SelectItem value="Cultural Festival">Cultural Festival</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {formErrors.primaryType && <p className="text-red-600 text-sm mt-1">{formErrors.primaryType}</p>}
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Add Festival</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4 mb-4">
            <Select value={viewMode} onValueChange={(value: "list" | "grid" | "calendar") => setViewMode(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">List View</SelectItem>
                <SelectItem value="grid">Grid View</SelectItem>
                <SelectItem value="calendar">Calendar View</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {viewMode !== "calendar" && (
            <div className="w-full flex flex-nowrap justify-between mb-4 space-x-1">
              {months.map((m) => (
                <Button
                  key={m.value}
                  variant={selectedMonth === m.value ? "default" : "outline"}
                  onClick={() => {
                    console.log("Month selected:", m.value);
                    setSelectedMonth(m.value);
                  }}
                  className="flex-1 px-2 py-1 text-sm min-w-0"
                >
                  {m.label}
                </Button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 border border-border/70 rounded-xl space-y-3 bg-card shadow-2xs">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : authError ? (
            <div className="p-6 text-center text-xs text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
              {authError}
            </div>
          ) : userRole ? (
            <div>
              {viewMode !== "calendar" && (
                <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">
                  Festivals in {getMonthName(selectedMonth)} {selectedYear}
                </h2>
              )}
              {renderFestivals()}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
              You do not have permission to view festivals.
            </div>
          )}

          <Dialog open={festivalDetailOpen} onOpenChange={setFestivalDetailOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedFestival?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Description</h4>
                  <p className="text-sm text-gray-600">{selectedFestival?.description}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Date</h4>
                  <p className="text-sm">📅 {selectedFestival ? formatFestivalDate(selectedFestival.date) : ""}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Type</h4>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {selectedFestival?.primaryType}
                  </span>
                </div>
                {canManageFestivals && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">Create Post</h4>
                    <div className="flex flex-col space-y-2">
                      {renderProjectSelector(selectedFestival?.id)}
                      <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                        {selectedFestival?.id && selectedProjectsByFestival[selectedFestival.id]?.map((projectId) => {
                          const project = projects?.find((p: Project) => p.id === projectId);
                          return project ? (
                            <div key={project.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`selected-project-detail-${selectedFestival.id}-${project.id}`}
                                checked={true}
                                onCheckedChange={() => handleProjectSelection(selectedFestival.id, project.id, false)}
                              />
                              <label
                                htmlFor={`selected-project-detail-${selectedFestival.id}-${project.id}`}
                                className="text-sm text-gray-700"
                              >
                                {project.client.companyName} - {project.name}
                              </label>
                            </div>
                          ) : null;
                        })}
                      </div>
                      <Button
                        onClick={() => selectedFestival && handleCreatePost(selectedFestival)}
                        disabled={!selectedFestival?.id || !selectedProjectsByFestival[selectedFestival.id]?.length}
                      >
                        Add to Posts
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {canManageFestivals && (
                <DialogFooter className="flex space-x-2">
                  <Button variant="outline" onClick={() => selectedFestival && handleEdit(selectedFestival)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          {canManageFestivals && (
            <Dialog open={editFormOpen} onOpenChange={setEditFormOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Festival</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Festival Name"
                      required
                      className={formErrors.name ? "border-red-500" : ""}
                    />
                    {formErrors.name && <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <Textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Festival Description"
                      required
                      className={formErrors.description ? "border-red-500" : ""}
                    />
                    {formErrors.description && <p className="text-red-600 text-sm mt-1">{formErrors.description}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <Input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      required
                      className={formErrors.date ? "border-red-500" : ""}
                    />
                    {formErrors.date && <p className="text-red-600 text-sm mt-1">{formErrors.date}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Primary Type</label>
                    <Select
                      value={formData.primaryType}
                      onValueChange={(value) => handleInputChange({ name: "primaryType", value })}
                    >
                      <SelectTrigger className={formErrors.primaryType ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="National Holiday">National Holiday</SelectItem>
                        <SelectItem value="Religious Holiday">Religious Holiday</SelectItem>
                        <SelectItem value="Cultural Festival">Cultural Festival</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.primaryType && <p className="text-red-600 text-sm mt-1">{formErrors.primaryType}</p>}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditFormOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Update Festival</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Festival</DialogTitle>
              </DialogHeader>
              <p>Are you sure you want to delete "{selectedFestival?.name}"? This action cannot be undone.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}