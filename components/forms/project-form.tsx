"use client";

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "react-hot-toast"; // Replace useToast with react-hot-toast
import {
  Loader2,
  ChevronDown,
  X,
  Search,
  Users,
  User,
  Check,
  Calendar,
  Building2,
  UserCheck,
  Crown,
  Hash,
  FileText,
  Target,
  Play,
  Image,
  Camera,
  Activity,
  ArrowLeft,
  Layers,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface Client {
  id: string;
  name: string;
  company: string;
}

interface Manager {
  id: number;
  name: string;
}

interface DesignerHead {
  id: number;
  name: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface PostTypeCount {
  [key: string]: number | string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface Strategy {
  id: number;
  month: number;
  year: number;
  postTypes: PostTypeCount;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  managerId: number | null;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  image?: string | null;
  postTypes: PostTypeCount | null;
  assignedUsers?: { id: string; role: { name: string } }[];
  strategies?: Strategy[];
}

interface ProjectFormProps {
  clients: Client[];
  managers: Manager[];
  designerHeads: DesignerHead[];
  users: User[];
  projects?: ProjectOption[];
  currentUser?: User;
  project?: Project;
  isEditing?: boolean;
  defaultMonth?: number;
  defaultYear?: number;
}

const CustomSelect = ({
  value,
  onValueChange,
  placeholder,
  icon: Icon,
  options,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  icon: any;
  options: { id: string; label: string }[];
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.id === value);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal h-11 px-4 bg-background hover:bg-muted/50 border-input"
        >
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className={selectedOption ? "text-foreground" : "text-muted-foreground"}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandList className="max-h-64">
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onValueChange(option.id);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${value === option.id ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                      }`}
                  >
                    {value === option.id && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function ProjectForm({
  clients = [],
  managers = [],
  designerHeads = [],
  users = [],
  projects = [],
  currentUser,
  project,
  isEditing = false,
  defaultMonth,
  defaultYear,
}: ProjectFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTeamSelectOpen, setIsTeamSelectOpen] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [postTypes] = useState<string[]>(["REEL", "STORY", "PHOTO", "CAROUSEL", "BLOG"]);

  // Initialize selected month and year
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth?.toString() || "");
  const [selectedYear, setSelectedYear] = useState(defaultYear?.toString() || "");

  // Generate month and year options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    id: (i + 1).toString(),
    label: new Date(0, i).toLocaleString("default", { month: "long" }),
  }));

  const yearOptions = Array.from({ length: 10 }, (_, i) => {
    const year = defaultYear ? defaultYear + i - 5 : new Date().getFullYear() + i - 5;
    return {
      id: year.toString(),
      label: year.toString(),
    };
  });

  // Initialize form data with strategy post types if editing and month/year selected
  const initialPostTypes = () => {
    if (isEditing && project?.strategies && selectedMonth && selectedYear) {
      const strategy = project.strategies.find(
        (s) => s.month === parseInt(selectedMonth) && s.year === parseInt(selectedYear)
      );
      const hasStrategyPostTypes = strategy?.postTypes && Object.keys(strategy.postTypes).length > 0;
      if (hasStrategyPostTypes) return strategy.postTypes;
    }
    return project?.postTypes || { REEL: 0, STORY: 0, PHOTO: 0, CAROUSEL: 0, BLOG: 0 };
  };

  const today = new Date().toISOString().split("T")[0];

  const getInitialManagerId = () => {
    if (project?.managerId) return project.managerId.toString();
    if (!isEditing && currentUser && currentUser.role?.toLowerCase() === "manager") {
      const isManager = managers.some((m) => m.id.toString() === currentUser.id.toString());
      if (isManager) return currentUser.id.toString();
    }
    return "";
  };

  const getInitialDesignerHeadId = () => {
    const existing = project?.assignedUsers?.find((user) => user.role.name === "Team Lead")?.id.toString();
    if (existing) return existing;
    if (!isEditing && currentUser && (currentUser.role?.toLowerCase() === "team lead" || currentUser.role?.toLowerCase() === "designer head")) {
      const isDesignerHead = designerHeads.some((d) => d.id.toString() === currentUser.id.toString());
      if (isDesignerHead) return currentUser.id.toString();
    }
    return "";
  };

  const getInitialAssignedTeamIds = () => {
    const existing = project?.assignedUsers?.map((user) => user.id.toString());
    if (existing && existing.length > 0) return existing;
    if (!isEditing && currentUser && currentUser.role?.toLowerCase() === "designer") {
      const isUser = users.some((u) => u.id.toString() === currentUser.id.toString());
      if (isUser) return [currentUser.id.toString()];
    }
    return [];
  };

  // Initialize form data with preselected team members and Team Lead
  const [formData, setFormData] = useState({
    name: project?.name || "",
    description: project?.description || "",
    clientId: project?.clientId || "",
    managerId: getInitialManagerId(),
    designerHeadId: getInitialDesignerHeadId(),
    assignedTeamIds: getInitialAssignedTeamIds(),
    startDate: project?.startDate ? new Date(project.startDate).toISOString().split("T")[0] : today,
    endDate: project?.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "",
    isActive: project?.isActive ?? true,
    postTypes: initialPostTypes() as PostTypeCount,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(project?.image || null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (isEditing && project?.strategies && selectedMonth && selectedYear) {
      const strategy = project.strategies.find(
        (s) => s.month === parseInt(selectedMonth) && s.year === parseInt(selectedYear)
      );
      const hasStrategyPostTypes = strategy?.postTypes && Object.keys(strategy.postTypes).length > 0;
      setFormData((prev) => ({
        ...prev,
        postTypes: (hasStrategyPostTypes ? strategy.postTypes : project.postTypes || { REEL: 0, STORY: 0, PHOTO: 0, CAROUSEL: 0, BLOG: 0 }) as PostTypeCount
      }));
    }
  }, [selectedMonth, selectedYear, project, isEditing]);

  useEffect(() => {
    if (project?.image) {
      setImagePreview(project.image);
    }
  }, [project?.image]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePostTypeChange = (postType: string, value: string) => {
    if (value === "") {
      setFormData({
        ...formData,
        postTypes: {
          ...formData.postTypes,
          [postType]: "",
        },
      });
      return;
    }
    const count = parseInt(value);
    setFormData({
      ...formData,
      postTypes: {
        ...formData.postTypes,
        [postType]: isNaN(count) || count < 0 ? 0 : count,
      },
    });
  };

  const handleTeamChange = (userId: string) => {
    setFormData((prev) => {
      const newAssignedTeamIds = prev.assignedTeamIds.includes(userId)
        ? prev.assignedTeamIds.filter((id) => id !== userId)
        : [...prev.assignedTeamIds, userId];
      return { ...prev, assignedTeamIds: newAssignedTeamIds };
    });
  };

  const removeTeamMember = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedTeamIds: prev.assignedTeamIds.filter((id) => id !== userId),
    }));
  };

  const clearAllTeamMembers = () => {
    setFormData({
      ...formData,
      assignedTeamIds: [],
    });
  };

  const getSelectedUsers = () => {
    const excludedRoles = ["manager", "admin"];
    return users.filter((user) =>
      formData.assignedTeamIds.includes(user.id.toString()) &&
      !excludedRoles.includes(user.role.toLowerCase())
    );
  };

  const getFilteredUsers = () => {
    const excludedRoles = ["manager", "admin"];
    const filtered = users.filter((user) => !excludedRoles.includes(user.role.toLowerCase()));
    if (!teamSearchQuery) return filtered;
    return filtered.filter(
      (user) =>
        user.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(teamSearchQuery.toLowerCase())
    );
  };

  const getRoleColor = (role: string) => {
    const colors = {
      Manager: "bg-blue-100 text-blue-800 border-blue-300",
      Designer: "bg-green-100 text-green-800 border-green-300",
      Developer: "bg-purple-100 text-purple-800 border-purple-300",
      "Team Lead": "bg-orange-100 text-orange-800 border-orange-300",
      Admin: "bg-red-100 text-red-800 border-red-300",
    };
    return colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case "REEL":
        return Play;
      case "STORY":
        return Image;
      case "PHOTO":
        return Camera;
      case "CAROUSEL":
        return Layers;
      case "BLOG":
        return FileText;
      default:
        return Hash;
    }
  };

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case "PHOTO":
        return "Static Post";
      case "CAROUSEL":
        return "Carousel";
      case "BLOG":
        return "Linkedin/Article";
      default:
        return type;
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      return "Project name is required.";
    }
    if (!formData.clientId) {
      return "Please select a client.";
    }
    if (!formData.startDate) {
      return "Start date is required.";
    }
    if (formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      return "End date cannot be earlier than start date.";
    }
    if (isEditing && (!selectedMonth || !selectedYear)) {
      return "Please select a month and year for the strategy.";
    }
    if (!formData.designerHeadId) {
      return "Please select a Team Lead (Team Lead).";
    }
    const hasDesigner = formData.assignedTeamIds.some((id) => {
      const user = users.find((u) => u.id.toString() === id);
      return user?.role === "Designer";
    });
    if (!hasDesigner) {
      return "At least one Designer must be assigned to the team.";
    }

    // Ensure at least one content requirement has a target > 0
    const hasTarget = Object.values(formData.postTypes).some(val => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    });
    if (!hasTarget) {
      return "Please set a target greater than 0 for at least one content requirement.";
    }

    return null;
  };

  const sendAssignmentEmails = async (projectId: string, assignedUserIds: number[]) => {
    console.log("📧 Starting to send assignment emails...");
    console.log("📧 ProjectId:", projectId, "AssignedUserIds:", assignedUserIds);

    if (!projectId || projectId === "null" || projectId === "undefined") {
      console.error("❌ Invalid projectId provided:", projectId);
      return {
        successful: 0,
        failed: assignedUserIds.length,
        totalAttempted: assignedUserIds.length,
        failedEmails: assignedUserIds.map((userId) => ({
          userId,
          success: false,
          error: "Invalid project ID",
        })),
      };
    }

    if (!assignedUserIds.length) {
      console.log("📧 No users to send emails to");
      return {
        successful: 0,
        failed: 0,
        totalAttempted: 0,
        failedEmails: [],
      };
    }

    const emailPromises = assignedUserIds.map(async (userId) => {
      try {
        console.log(`📧 Sending email to user ${userId} for project ${projectId}`);
        const response = await fetch("/api/email/project", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: projectId,
            assignedUserId: userId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`❌ Failed to send email to user ${userId}:`, errorData);
          return { userId, success: false, error: errorData.error || "Unknown error" };
        }

        console.log(`✅ Email sent successfully to user ${userId}`);
        return { userId, success: true };
      } catch (error) {
        console.error(`❌ Error sending email to user ${userId}:`, error);
        return {
          userId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const results = await Promise.allSettled(emailPromises);

    const successfulEmails = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((result) => result.success);

    const failedEmails = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((result) => !result.success);

    console.log(`📧 Email results: ${successfulEmails.length} successful, ${failedEmails.length} failed`);

    return {
      successful: successfulEmails.length,
      failed: failedEmails.length,
      totalAttempted: assignedUserIds.length,
      failedEmails,
    };
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      console.log("🚀 Form submission started", { isEditing, isSubmitting, isLoading });

      if (isSubmitting) {
        console.log("⚠️ Already submitting, showing toast...");
        toast.error("A project submission is already in progress. Please wait.", {
          duration: 3000,
        });
        return;
      }

      const validationError = validateForm();
      if (validationError) {
        console.log("❌ Validation failed:", validationError);
        toast.error(validationError, {
          duration: 5000,
        });
        return;
      }

      setIsLoading(true);
      setIsSubmitting(true);

      console.log("📤 Showing submission started toast...");
      toast.loading(isEditing ? "Updating Project..." : "Creating Project...", {
        duration: 2000,
      });

      try {
        const url = isEditing ? `/api/projects/${project?.id}` : "/api/projects";
        const method = isEditing ? "PUT" : "POST";

        const assignedUserIds = [];
        if (formData.managerId) assignedUserIds.push(parseInt(formData.managerId));
        if (formData.designerHeadId) assignedUserIds.push(parseInt(formData.designerHeadId));
        formData.assignedTeamIds.forEach((id) => assignedUserIds.push(parseInt(id)));

        const uniqueAssignedUserIds = [...new Set(assignedUserIds)];

        const parsedPostTypes: Record<string, number> = {};
        for (const [key, val] of Object.entries(formData.postTypes)) {
          parsedPostTypes[key] = val === "" ? 0 : Number(val);
        }

        const bodyFormData = new FormData();
        bodyFormData.append("name", formData.name);
        bodyFormData.append("description", formData.description);
        bodyFormData.append("clientId", formData.clientId);
        bodyFormData.append("managerId", formData.managerId || "");
        bodyFormData.append("designerHeadId", formData.designerHeadId);
        bodyFormData.append("assignedTeamIds", JSON.stringify(formData.assignedTeamIds));
        bodyFormData.append("startDate", formData.startDate);
        bodyFormData.append("endDate", formData.endDate || "");
        bodyFormData.append("isActive", String(formData.isActive));
        bodyFormData.append("postTypes", JSON.stringify(parsedPostTypes));
        bodyFormData.append("assignedUserIds", JSON.stringify(uniqueAssignedUserIds));
        if (isEditing) {
          bodyFormData.append("month", selectedMonth);
          bodyFormData.append("year", selectedYear);
        }
        if (imageFile) {
          bodyFormData.append("image", imageFile);
        } else if (removeImage) {
          bodyFormData.append("removeImage", "true");
        }

        console.log("📡 Making API request:", { url, method });

        const response = await fetch(url, {
          method,
          body: bodyFormData,
        });

        console.log("📡 API Response status:", response.status, response.ok);

        if (!response.ok) {
          let errorMessage = `Failed to ${isEditing ? "update" : "create"} project`;
          try {
            const errorData = await response.json();
            console.log("❌ API Error data:", errorData);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (parseError) {
            console.log("❌ Could not parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log("✅ Success response:", result);

        let projectId;
        if (isEditing) {
          projectId = project?.id;
        } else {
          projectId = result.id;
        }

        console.log("🆔 Extracted projectId:", projectId, "from result:", result);

        if (projectId && uniqueAssignedUserIds.length > 0) {
          console.log("📧 Sending assignment emails to users:", uniqueAssignedUserIds);

          toast.loading(`Sending notifications to ${uniqueAssignedUserIds.length} team member(s)...`, {
            duration: 2000,
          });

          const emailResults = await sendAssignmentEmails(projectId.toString(), uniqueAssignedUserIds);

          if (emailResults.successful > 0 && emailResults.failed === 0) {
            toast.success(`Assignment notifications sent to all ${emailResults.successful} team member(s).`, {
              duration: 4000,
            });
          } else if (emailResults.successful > 0 && emailResults.failed > 0) {
            toast.error(`${emailResults.successful} emails sent successfully, ${emailResults.failed} failed.`, {
              duration: 5000,
            });
          } else if (emailResults.failed > 0) {
            toast.error(`Failed to send assignment emails to team members.`, {
              duration: 5000,
            });
          }
        } else if (!projectId) {
          console.error("❌ No projectId found, cannot send emails");
          toast.error("Project created but assignment emails could not be sent (missing project ID).", {
            duration: 5000,
          });
        }

        toast.success(`The project "${formData.name}" has been ${isEditing ? "updated" : "created"} successfully.`, {
          duration: 4000,
        });

        setTimeout(() => {
          router.push("/dashboard/projects");
          router.refresh();
        }, 1500);
      } catch (error) {
        console.log("❌ Submission error:", error);
        const errorMessage = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        toast.error(errorMessage, {
          duration: 6000,
        });
        console.error("Full error details:", error);
      } finally {
        console.log("🔄 Resetting loading states");
        setIsLoading(false);
        setIsSubmitting(false);
      }
    },
    [formData, isEditing, project?.id, router, isSubmitting, selectedMonth, selectedYear, imageFile]
  );

  const clientOptions = clients.map((client) => ({
    id: client.id,
    label: client.name,
  }));

  const managerOptions = managers.map((manager) => ({
    id: manager.id.toString(),
    label: manager.name,
  }));

  const designerHeadOptions = designerHeads.map((designerHead) => ({
    id: designerHead.id.toString(),
    label: designerHead.name,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="pb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-primary"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Target className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl font-bold">
                {isEditing ? "Edit Project" : "Create New Project"}
              </CardTitle>
            </div>

          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Strategy Month/Year Selection (only for editing) */}
            {isEditing && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Strategy Period</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Month
                    </Label>
                    <CustomSelect
                      value={selectedMonth}
                      onValueChange={setSelectedMonth}
                      placeholder="Select a month"
                      icon={Calendar}
                      options={monthOptions}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Year
                    </Label>
                    <CustomSelect
                      value={selectedYear}
                      onValueChange={setSelectedYear}
                      placeholder="Select a year"
                      icon={Calendar}
                      options={yearOptions}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Basic Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    Project Name
                  </Label>
                  <div className="relative">
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter project name"
                      className="pl-10 h-11 bg-background border-input"
                      required
                    />
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="image" className="text-sm font-medium flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    Project Thumbnail / Image
                  </Label>
                  <div className="flex items-center gap-4">
                    {imagePreview && (
                      <div className="relative inline-block w-20 h-20">
                        <div className="w-full h-full rounded-lg overflow-hidden border">
                          <img 
                            src={imagePreview} 
                            alt="Project Preview" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=Error';
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full shadow-md z-10"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setImageFile(null);
                            setImagePreview(null);
                            setRemoveImage(true);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <Input
                      id="image"
                      name="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                          setRemoveImage(false);
                        }
                      }}
                      className="flex-1 h-11 bg-background border-input"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="description" className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Description
                  </Label>
                  <div className="relative">
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter project description"
                      rows={4}
                      className="pl-10 bg-background border-input resize-none"
                    />
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>

            {/* Client Information Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Client Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Client Name
                  </Label>
                  <CustomSelect
                    value={formData.clientId}
                    onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                    placeholder="Select a client"
                    icon={Building2}
                    options={clientOptions}
                  />
                </div>
              </div>
            </div>

            {/* Team Assignment Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Team Assignment</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    Manager
                  </Label>
                  <CustomSelect
                    value={formData.managerId}
                    onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                    placeholder="Select a manager"
                    icon={UserCheck}
                    options={managerOptions}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Crown className="h-4 w-4 text-muted-foreground" />
                    Team Lead
                  </Label>
                  <CustomSelect
                    value={formData.designerHeadId}
                    onValueChange={(value) => setFormData({ ...formData, designerHeadId: value })}
                    placeholder="Select a Team Lead"
                    icon={Crown}
                    options={designerHeadOptions}
                  />
                  <p className="text-xs text-muted-foreground">A Team Lead (Team Lead) is required.</p>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Team Members
                    </Label>
                    {formData.assignedTeamIds.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAllTeamMembers}
                        className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">At least one Designer must be assigned.</p>

                  {/* Selected Team Members Display */}
                  {formData.assignedTeamIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border min-h-[60px]">
                      {getSelectedUsers().map((user) => (
                        <Badge
                          key={user.id}
                          variant="secondary"
                          className={`flex items-center gap-2 px-3 py-2 ${getRoleColor(user.role)} text-sm`}
                        >
                          <User className="h-3 w-3" />
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs opacity-75">({user.role})</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTeamMember(user.id.toString())}
                            className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg border min-h-[60px] flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">No team members selected</span>
                    </div>
                  )}

                  {/* Team Selection Dropdown */}
                  <Popover open={isTeamSelectOpen} onOpenChange={setIsTeamSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal h-11 px-4 bg-background hover:bg-muted/50 border-input"
                      >
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {getSelectedUsers().length === 0
                              ? "Select team members"
                              : `${getSelectedUsers().length} member(s) selected`}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-sm p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const user = users.find((u) => u.id.toString() === value);
                          if (!user) return 0;
                          return (
                            user.name.toLowerCase().includes(search.toLowerCase()) ||
                            user.role.toLowerCase().includes(search.toLowerCase())
                          )
                            ? 1
                            : 0;
                        }}
                      >
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <CommandInput
                            placeholder="Search team members..."
                            value={teamSearchQuery}
                            onValueChange={setTeamSearchQuery}
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        <CommandList>
                          <CommandEmpty>No team members found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-y-auto">
                            {getFilteredUsers().map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.id.toString()}
                                onSelect={() => {
                                  handleTeamChange(user.id.toString());
                                }}
                                className="flex items-center space-x-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                              >
                                <div className="flex items-center space-x-2 flex-1">
                                  <div
                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.assignedTeamIds.includes(user.id.toString())
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground"
                                      }`}
                                  >
                                    {formData.assignedTeamIds.includes(user.id.toString()) && (
                                      <Check className="w-2.5 h-2.5" />
                                    )}
                                  </div>
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{user.name}</span>
                                    <span className="text-xs text-muted-foreground">{user.role}</span>
                                  </div>
                                </div>
                                <Badge variant="outline" className={`text-xs ${getRoleColor(user.role)}`}>
                                  {user.role}
                                </Badge>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Timeline Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Timeline</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="startDate" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Start Date
                  </Label>
                  <div className="relative">
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="pl-10 h-11 bg-background border-input"
                      required
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="endDate" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    End Date (Optional)
                  </Label>
                  <div className="relative">
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      className="pl-10 h-11 bg-background border-input"
                      min={formData.startDate}
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive" className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Project Active Status
                </Label>
              </div>
            </div>

            {/* Post Types Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Content Requirements</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {postTypes.map((postType) => {
                  const IconComponent = getPostTypeIcon(postType);
                  return (
                    <div key={postType} className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        {getPostTypeLabel(postType)}
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          value={formData.postTypes[postType] !== undefined ? formData.postTypes[postType] : ""}
                          onChange={(e) => handlePostTypeChange(postType, e.target.value)}
                          className="pl-10 h-11 bg-background border-input"
                          placeholder="0"
                        />
                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit Section */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading || isSubmitting}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isSubmitting}
                className="flex-1 h-11 bg-primary hover:bg-primary/90"
              >
                {isLoading || isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Target className="mr-2 h-4 w-4" />
                    {isEditing ? "Update Project" : "Create Project"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
