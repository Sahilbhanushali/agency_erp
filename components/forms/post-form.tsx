"use client";

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Upload, X, AlertTriangle, CheckCircle, Calendar, Users, Search, ChevronDown, Check, Copy } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { ValidationResult } from "@/lib/validation";
import { projectCompanyName } from "@/lib/client-company";

interface Project {
  id: string;
  name: string;
  client: {
    id: string;
    name: string;
    email?: string;
    company?: string;
  };
  assignedUsers?: Array<{
    id: number;
    name: string;
    role: { name: string };
  }>;
}

interface User {
  id: string;
  name: string;
  role?: string;
  email: string;
  assignedProjects: { id: string; name: string }[];
}

interface Festival {
  id: number;
  name: string;
  description: string;
  date: string;
  primaryType: string;
}

interface Asset {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  isReference: boolean;
  isEdited: boolean;
}

interface PostFormProps {
  projects: Project[];
  designers: User[];
  post?: {
    id: string;
    title: string;
    caption?: string;
    type: string;
    platforms: string[];
    projectId: string;
    scheduledAt?: string;
    designDueDate?: string;
    assignedToIds?: string[];
    assignedUsers?: any[];
    assignedToId?: number | string | null;
    festivalId?: number;
    customData?: {
      customType?: string;
      comment?: string;
      notes?: string;
      referenceUrl?: string;
    };
    writeUp?: string;
    keyword?: string;
    requiresClientApproval?: boolean;
    /** The post version this form was opened at (optimistic lock). */
    version?: number;
    notes?: string;
  };
  initialProjectId?: string;
  initialAssets?: Asset[];
}

interface Utility {
  id: string;
  name: string;
  type: string;
  values: string[];
}

export function PostForm({ projects, designers, post, initialProjectId, initialAssets = [] }: PostFormProps) {
  const [formData, setFormData] = useState({
    title: post?.title || "",
    caption: post?.caption || "",
    type: post?.type || "",
    platforms: post?.platforms && post.platforms.length > 0 ? post.platforms : [],
    projectId: post?.projectId || initialProjectId || "",
    scheduledAt: post?.scheduledAt,
    designDueDate: post?.designDueDate,
    assignedToIds: post?.assignedUsers?.map((u: any) => u.id.toString()) || (post?.assignedToId && post.assignedToId !== "unassigned" ? [post.assignedToId.toString()] : []), // updated for multiple
    festivalId: post?.festivalId?.toString() || "",
    customType: post?.customData?.customType || "",
    comment: post?.customData?.comment || "",
    notes: post?.notes || post?.customData?.notes || "",
    referenceUrl: post?.customData?.referenceUrl || "",
    writeUp: post?.writeUp || "",
    keyword: post?.keyword || "",
    /** Its own approval stage after internal approval; see lib/posts/workflow-rules.ts. */
    requiresClientApproval: Boolean(post?.requiresClientApproval),
  });
  /** Set when the server says this edit would undo an approval and needs a yes. */
  const [reapproval, setReapproval] = useState<{ message: string; changes: string[] } | null>(null);
  const confirmReapprovalRef = useRef(false);
  const [initialScheduledAt] = useState(post?.scheduledAt);
  const formRef = useRef<HTMLFormElement>(null);
  const [assets, setAssets] = useState<File[]>([]);
  const [removedInitialAssets, setRemovedInitialAssets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [assetValidation, setAssetValidation] = useState<{ [key: number]: ValidationResult }>({});
  const [postTypes, setPostTypes] = useState<
    Array<{ value: string; label: string; icon: string; description: string }>
  >([]);
  const [platforms, setPlatforms] = useState<Array<{ value: string; label: string; color: string }>>([]);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [filteredFestivals, setFilteredFestivals] = useState<Festival[]>([]);
  const [festivalSearch, setFestivalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const [filteredDesigners, setFilteredDesigners] = useState<User[]>([]);
  const [isDesignerDropdownOpen, setIsDesignerDropdownOpen] = useState(false);
  const [designerSearch, setDesignerSearch] = useState("");
  const [filteredDesignersList, setFilteredDesignersList] = useState<User[]>([]);
  const [isFestivalDropdownOpen, setIsFestivalDropdownOpen] = useState(false);

  const router = useRouter();



  // Keep designers list full and validate assignedToId
  useEffect(() => {
    const allDesigners = designers && Array.isArray(designers) ? designers : [];
    setFilteredDesigners(allDesigners);

    if (formData.projectId) {
      const selectedProject = projects.find((p) => p.id === formData.projectId);
      if (selectedProject) {
        // Validate assignedToId: reset to "unassigned" if not in allDesigners
        if (formData.assignedToIds && formData.assignedToIds.length > 0) {
          const validIds = formData.assignedToIds.filter((id: string) => 
            allDesigners.some(designer => designer.id.toString() === id)
          );
          if (validIds.length !== formData.assignedToIds.length) {
            setFormData((prev) => ({ ...prev, assignedToIds: validIds }));
          }
        }
      }
    }
  }, [formData.projectId, designers, projects, post]);

  // Auto-select content type based on assigned user's role and validate
  useEffect(() => {
    if (formData.assignedToIds && formData.assignedToIds.length > 0) {
      const assignedUser = filteredDesigners.find((d) => d.id.toString() === formData.assignedToIds[0]);
      if (assignedUser) {
        const role = assignedUser.role?.toLowerCase() || "";
        if (role === "video editor") {
          // Auto-select REEL for Video Editor
          if (formData.type !== "REEL") {
            // setFormData((prev) => ({ ...prev, type: "REEL" }));
            toast.success("Content type automatically set to Reel for Video Editor", {
              duration: 3000,
              position: "top-right",
            });
          }
        } else if (role === "designer") {
          // If currently REEL, switch to PHOTO for Designer
          if (formData.type === "REEL") {
            setFormData((prev) => ({ ...prev, type: "PHOTO" }));
            toast.success("Content type automatically set to Static Post for Designer", {
              duration: 3000,
              position: "top-right",
            });
          }
        }
      }
    }
  }, [formData.assignedToIds, filteredDesigners]);

  // Filter festivals based on search
  useEffect(() => {
    if (festivalSearch.trim() === "") {
      setFilteredFestivals(festivals);
    } else {
      const searchTerm = festivalSearch.toLowerCase();
      const filtered = festivals.filter(
        (festival) =>
          festival.name.toLowerCase().includes(searchTerm) ||
          festival.description.toLowerCase().includes(searchTerm) ||
          festival.primaryType.toLowerCase().includes(searchTerm)
      );
      setFilteredFestivals(filtered);
    }
  }, [festivals, festivalSearch]);

  // Filter designers based on search
  useEffect(() => {
    if (designerSearch.trim() === "") {
      setFilteredDesignersList(filteredDesigners);
    } else {
      const searchTerm = designerSearch.toLowerCase().replace(/\s+/g, '');
      const filtered = filteredDesigners.filter((designer) => {
        const designerName = designer.name.toLowerCase().replace(/\s+/g, '');
        return designerName.includes(searchTerm) || designer.name.toLowerCase().includes(designerSearch.toLowerCase());
      });
      setFilteredDesignersList(filtered);
    }
  }, [filteredDesigners, designerSearch]);

  // Validation state calculator
  useEffect(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic required fields
    if (!formData.title || !formData.title.trim()) errors.push("Post title is required.");
    if (!formData.projectId) errors.push("Project selection is required.");
    if (!formData.type) errors.push("Content type is required.");
    // Presentations are internal deliverables, not published to a platform.
    if (formData.platforms.length === 0 && formData.type !== "PPT") errors.push("At least one platform must be selected.");

    // Role-based content type validation
    if (formData.assignedToIds && formData.assignedToIds.length > 0 && formData.type) {
      const assignedUser = filteredDesigners.find((d) => d.id.toString() === formData.assignedToIds[0]);
      if (assignedUser) {
        const role = assignedUser.role?.toLowerCase() || "";
        if (role === "designer" && formData.type === "REEL") {
          errors.push("Designers cannot be assigned to Reel content.");
        } else if (role === "video editor" && ["PHOTO"].includes(formData.type)) {
          errors.push("Video Editors cannot be assigned to Static Post or Story content.");
        }
      }
    }

    // Character limit warnings
    if (formData.caption && formData.platforms.length > 0) {
      const charCount = getCharacterCount(formData.caption);
      if (charCount.current > charCount.max) {
        errors.push(`Caption exceeds character limit (${charCount.current}/${charCount.max} characters).`);
      } else if (charCount.current > charCount.max * 0.9) {
        warnings.push(`Caption is close to character limit (${charCount.current}/${charCount.max} characters).`);
      }
    }

    setValidation({
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  }, [formData, filteredDesigners]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const utilitiesResponse = await fetch("/api/utilities");
        if (!utilitiesResponse.ok) {
          throw new Error("Failed to fetch utilities");
        }
        const utilities: Utility[] = await utilitiesResponse.json();

        // Process post types
        const postTypeUtility = utilities.find((u) => u.type === "POST_TYPE");
        const basePostTypes = postTypeUtility
          ? postTypeUtility.values
            .filter((value): value is string => typeof value === "string")
            .map((value) => ({
              value: value.toUpperCase().replace(/\s+/g, "_"),
              label: value,
              icon: getPostTypeIcon(value),
              description: getPostTypeDescription(value),
            }))
          : [
            { value: "PHOTO", label: "Static Post", icon: "📷", description: "Single image post" },
            { value: "REEL", label: "Reel/Video", icon: "🎬", description: "Short video content" },
            { value: "STORY", label: "Story", icon: "📱", description: "24-hour story content" },
            { value: "CAROUSEL", label: "Carousel", icon: "🎠", description: "Multiple images/videos" },
            { value: "BLOG", label: "Linkedin/Article", icon: "📝", description: "Linkedin or article content" },
          ];
        // PPT is a first-class type in the schema, so it is offered even when the
        // configured POST_TYPE list predates it.
        if (!basePostTypes.some((t) => t.value === "PPT")) {
          basePostTypes.push({ value: "PPT", label: "PPT (Presentation)", icon: "📊", description: "Presentation deck (.ppt / .pptx), internal deliverable" });
        }
        setPostTypes(basePostTypes);

        // Process platforms
        const platformUtility = utilities.find((u) => u.type === "PLATFORM");
        const platformsData = platformUtility
          ? platformUtility.values
            .filter((value): value is string => typeof value === "string")
            .map((value) => ({
              value: value.toUpperCase().replace(/\s+/g, "_"),
              label: value,
              color: getPlatformColor(value),
            }))
          : [
            { value: "INSTAGRAM", label: "Instagram", color: "bg-pink-100 text-pink-800" },
            { value: "FACEBOOK", label: "Facebook", color: "bg-blue-100 text-blue-800" },
            { value: "LINKEDIN", label: "LinkedIn", color: "bg-blue-100 text-blue-900" },
            { value: "THREADS", label: "Threads", color: "bg-muted text-foreground" },
            { value: "GMB", label: "Google My Business", color: "bg-muted text-foreground" },
            { value: "YOUTUBE", label: "YouTube", color: "bg-red-100 text-red-800" },
            { value: "PINTEREST", label: "Pinterest", color: "bg-red-100 text-red-800" },
            { value: "WEBSITE", label: "Website", color: "bg-emerald-100 text-emerald-800" }
          ];
        setPlatforms(platformsData);

        const festivalsResponse = await fetch("/api/festivals");
        if (!festivalsResponse.ok) {
          throw new Error("Failed to fetch festivals");
        }
        const festivalsData = await festivalsResponse.json();
        setFestivals(Array.isArray(festivalsData) ? festivalsData : []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load form data. Please try again.", {
          duration: 5000,
          position: "top-right",
          icon: <AlertTriangle className="h-4 w-4" />,
        });
        setPostTypes([
          { value: "PHOTO", label: "Static Post", icon: "📷", description: "Single image post" },
          { value: "REEL", label: "Reel/Video", icon: "🎬", description: "Short video content" },
          { value: "STORY", label: "Story", icon: "📱", description: "24-hour story content" },
          { value: "CAROUSEL", label: "Carousel", icon: "🎠", description: "Multiple images/videos" },
          { value: "BLOG", label: "Linkedin/Article", icon: "📝", description: "Linkedin or article content" },
          { value: "PPT", label: "PPT (Presentation)", icon: "📊", description: "Presentation deck (.ppt / .pptx), internal deliverable" },
        ]);
        setPlatforms([
          { value: "INSTAGRAM", label: "Instagram", color: "bg-pink-100 text-pink-800" },
          { value: "FACEBOOK", label: "Facebook", color: "bg-blue-100 text-blue-800" },
          { value: "LINKEDIN", label: "LinkedIn", color: "bg-blue-100 text-blue-900" },
          { value: "THREADS", label: "Threads", color: "bg-muted text-foreground" },
          { value: "GMB", label: "Google My Business", color: "bg-muted text-foreground" },
          { value: "YOUTUBE", label: "YouTube", color: "bg-red-100 text-red-800" },
          { value: "PINTEREST", label: "Pinterest", color: "bg-red-100 text-red-800" },
          { value: "WEBSITE", label: "Website", color: "bg-emerald-100 text-emerald-800" }
        ]);
        setFestivals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getPostTypeIcon = (type: string): string => {
    const iconMap: { [key: string]: string } = {
      "Photo Post": "📷",
      Story: "📱",
      Reel: "🎬",
      Carousel: "🎠",
      Video: "🎥",
      "Live Stream": "📺",
      IGTV: "📹",
      Other: "✨",
      Custom: "✨",
      Festival: "🎉",
      Blog: "📝",
      "Linkedin/Article": "📝",
    };
    return iconMap[type] || "📄";
  };

  const getPostTypeDescription = (type: string): string => {
    const descMap: { [key: string]: string } = {
      "Static Post": "Single image post",
      Story: "24-hour story content (caption optional)",
      Reel: "Short video content",
      Carousel: "Multiple images/videos",
      Video: "Long-form video",
      "Live Stream": "Real-time streaming",
      IGTV: "Long-form vertical video",
      Other: "Custom content type",
      Custom: "Custom story content",
      Festival: "Festival-themed story",
      Blog: "Linkedin or article content",
      "Linkedin/Article": "Linkedin or article content",
    };
    return descMap[type] || "Custom content";
  };

  const getPlatformColor = (platform: string): string => {
    const colorMap: { [key: string]: string } = {
      Instagram: "bg-pink-100 text-pink-800",
      Facebook: "bg-blue-100 text-blue-800",
      LinkedIn: "bg-blue-100 text-blue-900",
      Threads: "bg-muted text-foreground",
      Twitter: "bg-sky-100 text-sky-800",
      TikTok: "bg-muted text-foreground",
      Website: "bg-emerald-100 text-emerald-800",
      WEBSITE: "bg-emerald-100 text-emerald-800",
    };
    return colorMap[platform] || "bg-muted text-foreground";
  };

  const handleTypeChange = (newType: string) => {
    const assignedUser = formData.assignedToIds && formData.assignedToIds.length > 0
      ? filteredDesigners.find((d) => d.id.toString() === formData.assignedToIds[0])
      : null;
    const role = assignedUser?.role?.toLowerCase() || "";

    // Validate content type based on role
    if (role === "designer" && newType === "REEL") {
      toast.error("Designers cannot select Reel content. Please choose another type.", {
        duration: 4000,
        position: "top-right",
        icon: <AlertTriangle className="h-4 w-4" />,
      });
      return;
    } else if (role === "video editor" && ["PHOTO"].includes(newType)) {
      toast.error("Video Editors can only select Reel content.", {
        duration: 4000,
        position: "top-right",
        icon: <AlertTriangle className="h-4 w-4" />,
      });
      return;
    }

    setFormData({ ...formData, type: newType });

  };

  const handleDesignerChange = (designerIdRaw: any) => {
    const designerId = designerIdRaw.toString();
    setFormData((prev) => {
      const current = prev.assignedToIds || [];
      const isSelected = current.includes(designerId);
      let newAssignedToIds;
      if (isSelected) {
        newAssignedToIds = current.filter((id: string) => id !== designerId);
      } else {
        newAssignedToIds = [...current, designerId];
      }
      return { ...prev, assignedToIds: newAssignedToIds };
    });

    // Validate content type after designer change
    const assignedUser = filteredDesigners.find((d) => d.id.toString() === designerId);
    if (assignedUser && formData.type) {
      const role = assignedUser.role?.toLowerCase() || "";
      if (role === "designer" && formData.type === "REEL") {
        toast.error("Designers cannot be assigned to Reel content. Resetting to Static Post.", {
          duration: 4000,
          position: "top-right",
          icon: <AlertTriangle className="h-4 w-4" />,
        });
        setFormData((prev) => ({ ...prev, type: "PHOTO" }));
      } else if (role === "video editor" && ["PHOTO"].includes(formData.type)) {
        toast.error("Video Editors can only be assigned to Reel content. Resetting to Reel.", {
          duration: 4000,
          position: "top-right",
          icon: <AlertTriangle className="h-4 w-4" />,
        });
        setFormData((prev) => ({ ...prev, type: "REEL" }));
      }
    }
    
    // Auto-close dropdown when a designer is selected
    setIsDesignerDropdownOpen(false);
  };

  const handleFestivalChange = (festivalId: string) => {
    const selectedFestival = festivals.find((f) => f.id.toString() === festivalId);
    if (selectedFestival) {
      const festivalDate = new Date(selectedFestival.date);
      if (isNaN(festivalDate.getTime())) {
        console.error("Invalid festival date:", selectedFestival.date);
        toast.error("Invalid festival date. Please select another festival.", {
          duration: 4000,
          position: "top-right",
        });
        setFormData({ ...formData, festivalId });
        return;
      }
      const now = new Date();
      const formattedDate = `${festivalDate.getFullYear()}-${String(festivalDate.getMonth() + 1).padStart(2, "0")}-${String(festivalDate.getDate()).padStart(2, "0")}T09:00`;
      if (festivalDate >= now) {
        setFormData({ ...formData, festivalId, scheduledAt: formattedDate });
        toast.success(`Scheduled date set to ${formattedDate} for ${selectedFestival.name}`, {
          duration: 3000,
          position: "top-right",
        });
      } else {
        setFormData({ ...formData, festivalId, scheduledAt: new Date().toISOString().slice(0, 16) });
        toast.error("Selected festival date is in the past.", {
          duration: 4000,
          position: "top-right",
        });
      }
    } else {
      setFormData({ ...formData, festivalId, scheduledAt: new Date().toISOString().slice(0, 16) });
      toast.error("Festival not found.", {
        duration: 4000,
        position: "top-right",
      });
    }
    setIsFestivalDropdownOpen(false);
    setFestivalSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation check on submit
    const submitErrors: string[] = [];
    const newFieldErrors: { [key: string]: string } = {};

    if (!formData.title || !formData.title.trim()) {
      submitErrors.push("Post title is required.");
      newFieldErrors.title = "Post title is required.";
    }
    if (!formData.projectId) {
      submitErrors.push("Project selection is required.");
      newFieldErrors.projectId = "Project selection is required.";
    }
    if (!formData.type) {
      submitErrors.push("Content type is required.");
      newFieldErrors.type = "Content type is required.";
    }
    if (formData.platforms.length === 0 && formData.type !== "PPT") {
      submitErrors.push("At least one platform must be selected.");
      newFieldErrors.platforms = "At least one platform must be selected.";
    }

    if (formData.assignedToIds && formData.assignedToIds.length > 0 && formData.type) {
      const assignedUser = filteredDesigners.find((d) => d.id.toString() === formData.assignedToIds[0]);
      if (assignedUser) {
        const role = assignedUser.role?.toLowerCase() || "";
        if (role === "designer" && formData.type === "REEL") {
          submitErrors.push("Designers cannot be assigned to Reel content.");
          newFieldErrors.type = "Designers cannot be assigned to Reel content.";
        } else if (role === "video editor" && ["PHOTO"].includes(formData.type)) {
          submitErrors.push("Video Editors cannot be assigned to Static Post or Story content.");
          newFieldErrors.type = "Video Editors cannot be assigned to Static Post content.";
        }
      }
    }

    if (submitErrors.length > 0 || Object.keys(assetValidation).length > 0) {
      setFieldErrors(newFieldErrors);
      const summaryMsg = `Please fix validation errors: ${submitErrors.join(" ")}`;
      setError(summaryMsg);
      toast.error(summaryMsg, {
        duration: 6000,
        position: "top-right",
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        style: {
          background: "#fee2e2",
          color: "#991b1b",
          border: "1px solid #fca5a5",
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        // The date input only holds a day, so re-sending an untouched value would move a
        // scheduled post to midnight. Send the date only when the person changed it.
        if (key === "scheduledAt" && post && value === initialScheduledAt) return;
        if (key === "platforms" || key === "assignedToIds") {
          submitData.append(key, JSON.stringify(value));
        } else if (key === "assignedToId" && value === "unassigned") {
          submitData.append(key, "");
        } else if (key === "customType" || key === "comment" || key === "notes" || key === "referenceUrl" || key === "writeUp") {
          return;
        } else {
          submitData.append(key, value as string);
        }
      });

      const customData: any = {};
      if (formData.notes) customData.notes = formData.notes;
      if (formData.referenceUrl) customData.referenceUrl = formData.referenceUrl;

      if (Object.keys(customData).length > 0) {
        submitData.append("customData", JSON.stringify(customData));
      }
      if (formData.writeUp) {
        submitData.append("writeUp", formData.writeUp);
      }
      if (formData.keyword) {
        submitData.append("keyword", formData.keyword);
      }
      if (formData.referenceUrl) {
        submitData.append("referenceUrl", formData.referenceUrl);
      }
      if (formData.notes) {
        submitData.append("notes", formData.notes);
      }

      assets.forEach((file) => {
        submitData.append(`assets`, file);
      });

      if (removedInitialAssets.length > 0) {
        submitData.append("removedAssets", JSON.stringify(removedInitialAssets));
      }
      // The version this form was opened at: a newer save by someone else is a 409,
      // not a silent overwrite.
      if (post?.version) submitData.append("expectedVersion", String(post.version));
      if (confirmReapprovalRef.current) submitData.append("confirmReapproval", "true");
      confirmReapprovalRef.current = false;

      const url = post ? `/api/posts/${post.id}` : "/api/posts";
      const method = post ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: submitData,
      });

      if (response.ok) {
        toast.success(post ? "Post updated successfully!" : "Post created successfully!", {
          duration: 3000,
          position: "top-right",
          icon: <CheckCircle className="h-4 w-4" />,
        });

        const emailData = {
          title: formData.title,
          caption: formData.caption,
          type: formData.type,
          platforms: formData.platforms,
          projectId: formData.projectId,
          scheduledAt: formData.scheduledAt,
          designDueDate: formData.designDueDate,
          assignedToId: formData.assignedToIds && formData.assignedToIds.length > 0 ? formData.assignedToIds : null,
          festivalId: formData.festivalId ? parseInt(formData.festivalId) : null,
          customData: Object.keys(customData).length > 0 ? customData : null,
          writeUp: formData.writeUp,
        };

        if (formData.assignedToIds && formData.assignedToIds.length > 0) {
          try {
            const emailResponse = await fetch("/api/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(emailData),
            });

            if (!emailResponse.ok) {
              const emailErrorData = await emailResponse.json();
              console.error("Email API error:", emailErrorData);
              toast.error(`Post saved, but failed to send email: ${emailErrorData.error || "Unknown error"}`, {
                duration: 5000,
                position: "top-right",
              });
            } else {
              toast.success("Email notification sent to designer!", {
                duration: 3000,
                position: "top-right",
              });
            }
          } catch (emailError) {
            console.error("Error calling email API:", emailError);
            toast.error("Post saved, but failed to send email: Network error", {
              duration: 5000,
              position: "top-right",
            });
          }
        }

        router.push(`/dashboard/projects/posts?projectId=${formData.projectId}`);
      } else {
        let errorData: any = {};
        let rawText = "";
        try {
          rawText = await response.text();
          errorData = JSON.parse(rawText);
        } catch (e) {
          console.error("Failed to parse backend response as JSON:", rawText);
        }

        const backendFieldErrors: { [key: string]: string } = {};
        const detailMsgs: string[] = [];

        if (errorData.details) {
          if (Array.isArray(errorData.details)) {
            errorData.details.forEach((item: any) => {
              if (typeof item === "object" && item !== null) {
                const fieldName = item.path && item.path.length > 0 ? String(item.path[0]) : null;
                const msg = item.message || "Invalid value";
                if (fieldName) {
                  backendFieldErrors[fieldName] = msg;
                  detailMsgs.push(`${fieldName}: ${msg}`);
                } else {
                  detailMsgs.push(msg);
                }
              } else {
                detailMsgs.push(String(item));
              }
            });
          } else if (typeof errorData.details === "string") {
            detailMsgs.push(errorData.details);
          } else if (typeof errorData.details === "object") {
            detailMsgs.push(JSON.stringify(errorData.details));
          }
        }

        if (response.status === 409 && errorData.code === "REAPPROVAL_REQUIRED") {
          // Not an error: ask before an edit sends an approved post back for approval.
          setReapproval({ message: errorData.error, changes: errorData.changes ?? [] });
          return;
        }

        let mainErrorText = errorData.error || errorData.message;
        if (!mainErrorText && response.status) {
          mainErrorText = `Backend Error (HTTP ${response.status}${response.statusText ? ": " + response.statusText : ""})`;
        }
        if (!mainErrorText) {
          mainErrorText = "Failed to update post";
        }

        let fullMessage = mainErrorText;
        if (detailMsgs.length > 0) {
          fullMessage += ` - ${detailMsgs.join(", ")}`;
        }

        setError(fullMessage);
        setFieldErrors(backendFieldErrors);

        toast.error(fullMessage, {
          duration: 7000,
          position: "top-right",
          icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
          style: {
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fca5a5",
            fontWeight: "500",
          },
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error: any) {
      console.error("Error submitting form:", error);
      const errorMsg = `Submission Error: ${error?.message || "Network error. Please try again."}`;
      setError(errorMsg);
      toast.error(errorMsg, {
        duration: 7000,
        position: "top-right",
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        style: {
          background: "#fee2e2",
          color: "#991b1b",
          border: "1px solid #fca5a5",
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlatformChange = useCallback((platform: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      platforms: checked
        ? [...prev.platforms, platform]
        : prev.platforms.filter((p) => p !== platform),
    }));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processUploadedFiles(Array.from(e.target.files));
    }
  };

  const processUploadedFiles = (files: File[]) => {
    const newFiles = files.filter((file) => {
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is 100MB.`, {
          duration: 4000,
          position: "top-right",
        });
        return false;
      }
      return true;
    });
    setAssets((prev) => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
      toast.success(`${newFiles.length} file(s) added!`, {
        duration: 2000,
        position: "top-right",
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index));
    toast.success("File removed.", {
      duration: 2000,
      position: "top-right",
    });
  };

  const removeInitialAsset = (assetId: string) => {
    setRemovedInitialAssets([...removedInitialAssets, assetId]);
    toast.success("Reference asset marked for removal.", {
      duration: 2000,
      position: "top-right",
    });
  };

  const getCharacterCount = (text: string) => {
    const limits = {
      INSTAGRAM: 2200,
      FACEBOOK: 63206,
      LINKEDIN: 3000,
      THREADS: 500,
    };
    const maxLimit =
      formData.platforms.length > 0
        ? Math.min(...formData.platforms.map((p) => limits[p as keyof typeof limits] || 2200))
        : 2200;

    return {
      current: text.length,
      max: maxLimit,
    };
  };

  const getHashtagCount = (text: string) => {
    return (text.match(/#\w+/g) || []).length;
  };

  const selectedProject = projects.find((p) => p.id === formData.projectId);
  const selectedDesigners = filteredDesigners.filter((d) => (formData.assignedToIds || []).includes(d.id));
  const selectedFestival = festivals.find((f) => f.id.toString() === formData.festivalId);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/projects/posts?projectId=${selectedProject?.id || ""}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <CardTitle>{post ? "Edit Post" : "New Post"}</CardTitle>
            {selectedProject && (
              <p className="text-sm text-muted-foreground mt-1">
                <Users className="inline h-4 w-4 mr-1" />
                {selectedProject.name} - {projectCompanyName(selectedProject) || "No Client"}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {projects.length === 0 && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No active projects available. You need to create a project before you can create posts.
              <Link href="/dashboard/projects/new" className="ml-2 text-blue-600 hover:underline">
                Create Project
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {filteredDesigners.length === 0 && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No team members available. Please add users in Settings to assign them to posts.
            </AlertDescription>
          </Alert>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title" className={fieldErrors.title ? "text-red-600 font-semibold" : ""}>
                Post Title *
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="Enter a descriptive title for your post"
                className={`transition-all duration-200 focus:ring-2 ${
                  fieldErrors.title
                    ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                    : "focus:ring-blue-500"
                }`}
              />
              {fieldErrors.title && (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.title}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="project" className={fieldErrors.projectId ? "text-red-600 font-semibold" : ""}>
                Project *
              </Label>
              <SearchableSelect
                value={formData.projectId}
                onValueChange={(value) => {
                  setFormData({ ...formData, projectId: value });
                  if (fieldErrors.projectId) setFieldErrors((prev) => ({ ...prev, projectId: "" }));
                }}
                disabled={projects.length === 0}
                placeholder={projects.length === 0 ? "No active projects available" : "Select or search project..."}
                options={projects.map((project) => ({
                  id: project.id,
                  label: project.name,
                  subLabel: projectCompanyName(project) || project.client?.name || "Internal",
                }))}
                maxDisplay={100}
                className={`transition-all duration-200 ${
                  fieldErrors.projectId
                    ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                    : ""
                }`}
              />
              {fieldErrors.projectId && (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.projectId}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className={fieldErrors.type ? "text-red-600 font-semibold" : ""}>Content Type *</Label>
              <div
                className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-2 p-2 rounded-lg transition-all ${
                  fieldErrors.type ? "ring-2 ring-red-500 bg-red-50/20 border border-red-300" : ""
                }`}
              >
                {postTypes.map((type) => (
                  <div
                    key={type.value}
                    className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                      formData.type === type.value
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      handleTypeChange(type.value);
                      if (fieldErrors.type) setFieldErrors((prev) => ({ ...prev, type: "" }));
                    }}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="text-xs font-medium text-foreground">{type.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{type.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              {fieldErrors.type && (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.type}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedToId" className={fieldErrors.assignedToIds || fieldErrors.assignedToId ? "text-red-600 font-semibold" : ""}>
                Assigned Creator / Team Member
              </Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDesignerDropdownOpen(!isDesignerDropdownOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2 border rounded-md bg-white text-sm focus:outline-none focus:ring-2 transition-all duration-200 ${
                    fieldErrors.assignedToIds || fieldErrors.assignedToId
                      ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                      : "border-gray-200 focus:ring-blue-500"
                  }`}
                  disabled={loading || filteredDesigners.length === 0}
                >
                  <span className={formData.assignedToIds?.length ? "text-foreground" : "text-muted-foreground"}>
                    {formData.assignedToIds?.length
                      ? `${formData.assignedToIds.length} member(s) selected`
                      : filteredDesigners.length === 0
                        ? "No team members available"
                        : "Select team member(s)"}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDesignerDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isDesignerDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-80 overflow-hidden">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                        <Input aria-label="Search team member"
                          placeholder="Search team member..."
                          value={designerSearch}
                          onChange={(e) => setDesignerSearch(e.target.value)}
                          className="pl-10 h-8"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-auto">
                      {filteredDesignersList.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                          No designers match your search
                        </div>
                      ) : (
                        filteredDesignersList.map((designer) => (
                          <div
                            key={designer.id}
                            className="px-3 py-2 hover:bg-muted/50 cursor-pointer flex items-center"
                            onClick={() => {
                              handleDesignerChange(designer.id);
                              if (fieldErrors.assignedToIds || fieldErrors.assignedToId) {
                                setFieldErrors((prev) => ({ ...prev, assignedToIds: "", assignedToId: "" }));
                              }
                            }}
                          >
                            {(formData.assignedToIds || []).includes(designer.id.toString()) && <Check className="h-4 w-4 text-blue-600 mr-2" />}
                            <div className="flex flex-col">
                              <span
                                className={`text-sm ${(formData.assignedToIds || []).includes(designer.id.toString()) ? "text-blue-600 font-medium" : "text-foreground"}`}
                              >
                                {designer.name}
                              </span>
                              <span className="text-xs text-muted-foreground">{designer.role || "Designer"}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {(fieldErrors.assignedToIds || fieldErrors.assignedToId) && (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.assignedToIds || fieldErrors.assignedToId}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Select one or more team members to assign this post to. Leave unassigned if not yet assigned.
              </p>
            </div>

            {/* Client approval is a separate stage from internal approval, so it is a
                clearly labelled switch rather than a status. */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="requiresClientApproval" className="text-sm font-medium">
                  Client approval required
                </Label>
                <p id="requiresClientApproval-hint" className="text-xs text-muted-foreground">
                  {formData.requiresClientApproval
                    ? "After internal approval, the client approves through their share link before this can be scheduled."
                    : "Internal approval is enough — the post becomes ready to schedule as soon as it is approved."}
                </p>
              </div>
              <Switch
                id="requiresClientApproval"
                checked={formData.requiresClientApproval}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, requiresClientApproval: checked }))}
                aria-describedby="requiresClientApproval-hint"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className={fieldErrors.platforms ? "text-red-600 font-semibold" : ""}>
                  Platforms {formData.type === "PPT" ? "(optional for presentations)" : "*"}
                </Label>
              </div>
              <div
                className={`p-2 rounded-lg mt-1 transition-all ${
                  fieldErrors.platforms ? "ring-2 ring-red-500 bg-red-50/20 border border-red-300" : ""
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="platform-all"
                    checked={formData.platforms.length === platforms.length && platforms.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, platforms: platforms.map(p => p.value) });
                      } else {
                        setFormData({ ...formData, platforms: [] });
                      }
                      if (fieldErrors.platforms) setFieldErrors((prev) => ({ ...prev, platforms: "" }));
                    }}
                    className="transition-all duration-200"
                  />
                  <Label htmlFor="platform-all" className="text-sm font-medium cursor-pointer">
                    All
                  </Label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {platforms.map((platform) => (
                    <div key={platform.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={platform.value}
                        checked={formData.platforms.includes(platform.value)}
                        onCheckedChange={(checked) => {
                          handlePlatformChange(platform.value, checked as boolean);
                          if (fieldErrors.platforms) setFieldErrors((prev) => ({ ...prev, platforms: "" }));
                        }}
                        className="transition-all duration-200"
                      />
                      <Label htmlFor={platform.value} className="text-sm cursor-pointer">
                        <Badge variant="secondary" className={`${platform.color} text-xs px-2 py-1`}>
                          {platform.label}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              {fieldErrors.platforms && (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.platforms}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="writeUp" className={fieldErrors.writeUp ? "text-red-600 font-semibold" : ""}>
              Write-Up/Idea For Creative
            </Label>
            <Textarea
              id="writeUp"
              value={formData.writeUp}
              onChange={(e) => {
                setFormData({ ...formData, writeUp: e.target.value });
                if (fieldErrors.writeUp) setFieldErrors((prev) => ({ ...prev, writeUp: "" }));
              }}
              placeholder="Enter the write-up for this post..."
              rows={4}
              className={`transition-all duration-200 focus:ring-2 ${
                fieldErrors.writeUp
                  ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                  : "focus:ring-blue-500"
              }`}
            />
            {fieldErrors.writeUp && (
              <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                {fieldErrors.writeUp}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyword" className={fieldErrors.keyword ? "text-red-600 font-semibold" : ""}>
              Keyword
            </Label>
            <Input
              id="keyword"
              value={formData.keyword}
              onChange={(e) => {
                setFormData({ ...formData, keyword: e.target.value });
                if (fieldErrors.keyword) setFieldErrors((prev) => ({ ...prev, keyword: "" }));
              }}
              placeholder="Enter keyword..."
              className={`transition-all duration-200 focus:ring-2 ${
                fieldErrors.keyword
                  ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                  : "focus:ring-blue-500"
              }`}
            />
            {fieldErrors.keyword && (
              <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                {fieldErrors.keyword}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption" className={fieldErrors.caption ? "text-red-600 font-semibold" : ""}>
              Caption
            </Label>
            <div className="relative">
              <Textarea
                id="caption"
                value={formData.caption}
                onChange={(e) => {
                  setFormData({ ...formData, caption: e.target.value });
                  if (fieldErrors.caption) setFieldErrors((prev) => ({ ...prev, caption: "" }));
                }}
                placeholder="Write your caption here..."
                rows={4}
                className={`transition-all duration-200 focus:ring-2 pr-16 ${
                  fieldErrors.caption
                    ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                    : "focus:ring-blue-500"
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!formData.caption}
                className="absolute top-2 right-2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground bg-background/80 hover:bg-muted backdrop-blur-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                onClick={() => {
                  if (formData.caption) {
                    navigator.clipboard.writeText(formData.caption);
                    toast.success("Copy ho gaya", { duration: 2000, position: "top-right" });
                  }
                }}
                title="Copy caption"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            {fieldErrors.caption && (
              <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                {fieldErrors.caption}
              </p>
            )}
            {formData.caption && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Characters: {getCharacterCount(formData.caption).current}/{getCharacterCount(formData.caption).max}
                </span>
                <span>Hashtags: {getHashtagCount(formData.caption)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="designDueDate" className={fieldErrors.designDueDate ? "text-red-600 font-semibold" : ""}>
                Due Design Date
              </Label>
              <Input
                id="designDueDate"
                type="date"
                value={formData.designDueDate || ""}
                onChange={(e) => {
                  setFormData({ ...formData, designDueDate: e.target.value });
                  if (fieldErrors.designDueDate) setFieldErrors((prev) => ({ ...prev, designDueDate: "" }));
                }}
                className={`transition-all duration-200 focus:ring-2 block w-full text-left font-normal ${
                  fieldErrors.designDueDate
                    ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                    : "focus:ring-blue-500"
                }`}
              />
              {fieldErrors.designDueDate && (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.designDueDate}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAt" className={fieldErrors.scheduledAt ? "text-red-600 font-semibold" : ""}>
                Posting Date
              </Label>
              <Input
                id="scheduledAt"
                type="date"
                value={formData.scheduledAt || ""}
                onChange={(e) => {
                  setFormData({ ...formData, scheduledAt: e.target.value });
                  if (fieldErrors.scheduledAt) setFieldErrors((prev) => ({ ...prev, scheduledAt: "" }));
                }}
                className={`transition-all duration-200 focus:ring-2 block w-full text-left font-normal ${
                  fieldErrors.scheduledAt
                    ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                    : "focus:ring-blue-500"
                }`}
              />
              {fieldErrors.scheduledAt && (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.scheduledAt}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="referenceUrl" className={fieldErrors.referenceUrl ? "text-red-600 font-semibold" : ""}>
                Reference URL
              </Label>
              <Input
                id="referenceUrl"
                type="url"
                value={formData.referenceUrl}
                onChange={(e) => {
                  setFormData({ ...formData, referenceUrl: e.target.value });
                  if (fieldErrors.referenceUrl) setFieldErrors((prev) => ({ ...prev, referenceUrl: "" }));
                }}
                placeholder="https://example.com/reference"
                className={`transition-all duration-200 focus:ring-2 ${
                  fieldErrors.referenceUrl
                    ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                    : "focus:ring-blue-500"
                }`}
              />
              {fieldErrors.referenceUrl ? (
                <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  {fieldErrors.referenceUrl}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Optional reference link or inspiration</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className={fieldErrors.notes ? "text-red-600 font-semibold" : ""}>
              Additional Notes
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => {
                setFormData({ ...formData, notes: e.target.value });
                if (fieldErrors.notes) setFieldErrors((prev) => ({ ...prev, notes: "" }));
              }}
              placeholder="Any additional notes or special instructions..."
              rows={3}
              className={`transition-all duration-200 focus:ring-2 ${
                fieldErrors.notes
                  ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/30 text-red-900"
                  : "focus:ring-blue-500"
              }`}
            />
            {fieldErrors.notes && (
              <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                {fieldErrors.notes}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assets" className={fieldErrors.assets ? "text-red-600 font-semibold" : ""}>
              Reference Assets
            </Label>
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${
                fieldErrors.assets
                  ? "border-red-500 bg-red-50/20"
                  : isDragOver
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 scale-[1.01]"
                    : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input
                type="file"
                multiple
                accept="image/*,video/*,application/pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={handleFileChange}
                className="hidden"
                id="asset-upload"
              />
              <label htmlFor="asset-upload" className="cursor-pointer">
                <Upload className={`mx-auto h-12 w-12 mb-2 ${isDragOver ? "text-blue-500" : "text-muted-foreground"}`} />
                <p className="text-sm text-muted-foreground">Click to upload or drag & drop files here</p>
                <p className="text-xs text-muted-foreground mt-1">Images, videos, PDFs and presentations (.ppt, .pptx)</p>
              </label>
            </div>
            {fieldErrors.assets && (
              <p className="text-xs text-red-600 flex items-center font-medium mt-1">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                {fieldErrors.assets}
              </p>
            )}

            {(assets.length > 0 || initialAssets.length > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                {initialAssets
                  .filter((asset) => !removedInitialAssets.includes(asset.id))
                  .map((asset) => (
                    <div key={`initial-${asset.id}`} className="relative group">
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                        {asset.type.startsWith("image/") ? (
                          <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center p-4">
                            <div className="text-2xl mb-2">🎥</div>
                            <div className="text-xs text-muted-foreground truncate">{asset.filename}</div>
                          </div>
                        )}
                      </div>
                      <button aria-label={`Remove ${asset.filename}`}
                        type="button"
                        onClick={() => removeInitialAsset(asset.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{asset.filename}</p>
                    </div>
                  ))}
                {assets.map((asset, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {asset.type.startsWith("image/") ? (
                        <img
                          src={URL.createObjectURL(asset)}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <div className="text-2xl mb-2">🎥</div>
                          <div className="text-xs text-muted-foreground truncate">{asset.name}</div>
                        </div>
                      )}
                    </div>
                    <button aria-label={`Remove ${asset.name}`}
                      type="button"
                      onClick={() => removeAsset(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{asset.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-6 border-t">
            <Link href={`/dashboard/projects/posts?projectId=${selectedProject?.id || ""}`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isLoading || projects.length === 0}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {post ? "Updating..." : "Creating..."}
                </div>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {post ? "Update Post" : "Create Post"}
                </>
              )}
            </Button>
          </div>
        </form>

        <AlertDialog open={!!reapproval} onOpenChange={(open) => !open && setReapproval(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this post back for approval?</AlertDialogTitle>
              <AlertDialogDescription>
                {reapproval?.message}
                {reapproval?.changes.length ? ` Changed: ${reapproval.changes.join(", ")}.` : ""} The earlier
                approval stays in the post history but no longer applies to this version.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  confirmReapprovalRef.current = true;
                  setReapproval(null);
                  formRef.current?.requestSubmit();
                }}
              >
                Save and resubmit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}