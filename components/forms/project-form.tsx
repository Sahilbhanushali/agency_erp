"use client";

import type React from "react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { toast } from "react-hot-toast";
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
          className="w-full justify-between font-normal h-9 px-3 bg-background hover:bg-muted/50 border-border/70 text-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Icon className="size-3.5 text-muted-foreground shrink-0" />
            <span className={selectedOption ? "text-foreground font-medium truncate" : "text-muted-foreground truncate"}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandList className="max-h-64 text-xs">
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
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs"
                >
                  <div
                    className={`size-3.5 rounded-full border flex items-center justify-center ${value === option.id ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"}`}
                  >
                    {value === option.id && <Check className="size-2.5" />}
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

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth?.toString() || "");
  const [selectedYear, setSelectedYear] = useState(defaultYear?.toString() || "");

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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Team Lead":
        return "warning";
      case "Designer":
        return "success";
      case "Developer":
        return "purple";
      default:
        return "neutral";
    }
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
    if (!projectId || projectId === "null" || projectId === "undefined") {
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
      return {
        successful: 0,
        failed: 0,
        totalAttempted: 0,
        failedEmails: [],
      };
    }

    const emailPromises = assignedUserIds.map(async (userId) => {
      try {
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
          return { userId, success: false, error: errorData.error || "Unknown error" };
        }

        return { userId, success: true };
      } catch (error) {
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

      if (isSubmitting) {
        toast.error("A project submission is already in progress. Please wait.");
        return;
      }

      const validationError = validateForm();
      if (validationError) {
        toast.error(validationError);
        return;
      }

      setIsLoading(true);
      setIsSubmitting(true);

      toast.loading(isEditing ? "Updating Project..." : "Creating Project...");

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

        const response = await fetch(url, {
          method,
          body: bodyFormData,
        });

        if (!response.ok) {
          let errorMessage = `Failed to ${isEditing ? "update" : "create"} project`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();

        let projectId = isEditing ? project?.id : result.id;

        if (projectId && uniqueAssignedUserIds.length > 0) {
          const emailResults = await sendAssignmentEmails(projectId.toString(), uniqueAssignedUserIds);
          if (emailResults.successful > 0 && emailResults.failed === 0) {
            toast.success(`Notifications sent to all ${emailResults.successful} team member(s).`);
          }
        }

        toast.success(`Project "${formData.name}" ${isEditing ? "updated" : "created"} successfully.`);

        setTimeout(() => {
          router.push("/dashboard/projects");
          router.refresh();
        }, 1200);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        toast.error(errorMessage);
      } finally {
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
    <Card className="max-w-4xl mx-auto shadow-2xs">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <CardTitle>{isEditing ? "Edit Project Campaign" : "Create New Project"}</CardTitle>
            <CardDescription className="text-xs">
              {isEditing ? "Update project goals, team assignments, and monthly strategy targets." : "Set up a new client campaign with assigned designers and content targets."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Strategy Month/Year Selection (editing) */}
          {isEditing && (
            <div className="space-y-3 p-3.5 rounded-xl border border-border/60 bg-muted/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="size-3.5 text-primary" />
                <span>Strategy Period</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Month</Label>
                  <CustomSelect
                    value={selectedMonth}
                    onValueChange={setSelectedMonth}
                    placeholder="Select month"
                    icon={Calendar}
                    options={monthOptions}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Year</Label>
                  <CustomSelect
                    value={selectedYear}
                    onValueChange={setSelectedYear}
                    placeholder="Select year"
                    icon={Calendar}
                    options={yearOptions}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <FileText className="size-3.5 text-primary" />
              <span>Project Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="name" className="text-xs font-medium">Project Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Q4 Brand Refresh Campaign"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="description" className="text-xs font-medium">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Briefly describe campaign goals and design scope..."
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="image" className="text-xs font-medium">Project Thumbnail</Label>
                <div className="flex items-center gap-3">
                  {imagePreview && (
                    <div className="relative size-12 shrink-0 rounded-md overflow-hidden border border-border">
                      <img src={imagePreview} alt="Project Preview" className="size-full object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        className="absolute top-0.5 right-0.5 size-4 p-0 rounded-full"
                        onClick={(e) => {
                          e.preventDefault();
                          setImageFile(null);
                          setImagePreview(null);
                          setRemoveImage(true);
                        }}
                      >
                        <X className="size-2.5" />
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
                    className="h-9 text-xs file:mr-2 file:py-0.5 file:px-2 file:text-xs file:bg-primary/10 file:text-primary file:border-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Client & Team */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <Users className="size-3.5 text-primary" />
              <span>Client & Team Assignment</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Client <span className="text-destructive">*</span></Label>
                <CustomSelect
                  value={formData.clientId}
                  onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                  placeholder="Select client"
                  icon={Building2}
                  options={clientOptions}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Manager</Label>
                <CustomSelect
                  value={formData.managerId}
                  onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                  placeholder="Select manager"
                  icon={UserCheck}
                  options={managerOptions}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Team Lead <span className="text-destructive">*</span></Label>
                <CustomSelect
                  value={formData.designerHeadId}
                  onValueChange={(value) => setFormData({ ...formData, designerHeadId: value })}
                  placeholder="Select lead"
                  icon={Crown}
                  options={designerHeadOptions}
                />
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Assigned Designers & Developers <span className="text-destructive">*</span></Label>
                {formData.assignedTeamIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={clearAllTeamMembers}
                    className="text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {formData.assignedTeamIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-border/60 bg-muted/20 min-h-[48px]">
                  {getSelectedUsers().map((user) => (
                    <Badge
                      key={user.id}
                      variant={getRoleBadgeVariant(user.role)}
                      className="gap-1.5 px-2 py-0.5 text-xs"
                    >
                      <span>{user.name}</span>
                      <span className="opacity-75 text-[10px]">({user.role})</span>
                      <button
                        type="button"
                        onClick={() => removeTeamMember(user.id.toString())}
                        className="hover:opacity-75"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border/80 bg-muted/20 text-center">
                  <span className="text-xs text-muted-foreground">No designers or team members selected</span>
                </div>
              )}

              <Popover open={isTeamSelectOpen} onOpenChange={setIsTeamSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-9 px-3 bg-background hover:bg-muted/50 text-xs font-normal"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {getSelectedUsers().length === 0
                          ? "Select team members to assign..."
                          : `${getSelectedUsers().length} member(s) assigned`}
                      </span>
                    </div>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full max-w-sm p-0" align="start">
                  <Command>
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 size-3.5 shrink-0 opacity-50" />
                      <CommandInput
                        placeholder="Search team members..."
                        value={teamSearchQuery}
                        onValueChange={setTeamSearchQuery}
                        className="h-9 text-xs"
                      />
                    </div>
                    <CommandList>
                      <CommandEmpty className="py-4 text-xs text-center">No team members found.</CommandEmpty>
                      <CommandGroup className="max-h-56 overflow-y-auto">
                        {getFilteredUsers().map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id.toString()}
                            onSelect={() => handleTeamChange(user.id.toString())}
                            className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`size-3.5 rounded-full border flex items-center justify-center ${
                                  formData.assignedTeamIds.includes(user.id.toString())
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground"
                                }`}
                              >
                                {formData.assignedTeamIds.includes(user.id.toString()) && (
                                  <Check className="size-2.5" />
                                )}
                              </div>
                              <span className="font-medium text-foreground">{user.name}</span>
                            </div>
                            <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px]">
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

          {/* Timeline */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <Calendar className="size-3.5 text-primary" />
              <span>Dates & Active State</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs font-medium">Start Date <span className="text-destructive">*</span></Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="h-9 text-xs tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-medium">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="h-9 text-xs tabular-nums"
                  min={formData.startDate}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive" className="text-xs font-medium cursor-pointer">
                Active Campaign
              </Label>
            </div>
          </div>

          {/* Content Targets */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <Target className="size-3.5 text-primary" />
              <span>Monthly Content Targets</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {postTypes.map((postType) => {
                const IconComponent = getPostTypeIcon(postType);
                return (
                  <div key={postType} className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <IconComponent className="size-3 text-primary" />
                      {getPostTypeLabel(postType)}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.postTypes[postType] !== undefined ? formData.postTypes[postType] : ""}
                      onChange={(e) => handlePostTypeChange(postType, e.target.value)}
                      className="h-8 text-xs tabular-nums"
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              disabled={isLoading || isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={isLoading || isSubmitting}
            >
              {isEditing ? "Update Project" : "Create Project"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
