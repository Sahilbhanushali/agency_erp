"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { Camera, Loader2, Upload, Trash2, ShieldCheck, User, Link as LinkIcon, Image as ImageIcon, Sun, Moon, Laptop, Check } from "lucide-react"
import { resizeImageFile } from "@/lib/resize-image"
import { useTheme } from "next-themes"

export default function DashboardProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [externalUrl, setExternalUrl] = useState<string>("")
  const [avatarMode, setAvatarMode] = useState<"upload" | "url">("upload")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [userRole, setUserRole] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    avatar: "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load fresh user data directly from database on mount so the avatar is never lost or wiped out
  useEffect(() => {
    let isMounted = true

    async function loadUserProfile() {
      try {
        const res = await fetch("/api/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.user && isMounted) {
            const currentAvatar = data.user.avatar || ""
            setProfileData({
              name: data.user.name || "",
              email: data.user.email || "",
              avatar: currentAvatar,
            })
            setAvatarUrl(currentAvatar)
            if (data.user.role) setUserRole(data.user.role)

            // If the user's avatar is an external URL, prefill externalUrl and switch to URL tab
            if (currentAvatar.startsWith("http://") || currentAvatar.startsWith("https://")) {
              setExternalUrl(currentAvatar)
              setAvatarMode("url")
            } else {
              setExternalUrl("")
              setAvatarMode("upload")
            }
            return
          }
        }
      } catch (err) {
        console.error("Failed to load profile from API:", err)
      }

      // Fallback to session if API call fails
      if (session?.user && isMounted) {
        const sessionImage = session.user.image || ""
        setProfileData({
          name: session.user.name || "",
          email: session.user.email || "",
          avatar: sessionImage,
        })
        setAvatarUrl(sessionImage)
        if ((session.user as any).role) setUserRole((session.user as any).role)
        if (sessionImage.startsWith("http://") || sessionImage.startsWith("https://")) {
          setExternalUrl(sessionImage)
          setAvatarMode("url")
        } else {
          setExternalUrl("")
          setAvatarMode("upload")
        }
      }
    }

    if (session?.user) {
      loadUserProfile()
    }

    return () => {
      isMounted = false
    }
  }, [session])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const activeAvatar = avatarUrl || profileData.avatar || ""

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email,
          avatar: activeAvatar,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Profile updated successfully!")
        const updatedAvatar = data.user?.avatar || activeAvatar
        setAvatarUrl(updatedAvatar)
        setProfileData((prev) => ({ ...prev, avatar: updatedAvatar }))
        await update({ name: profileData.name, image: updatedAvatar })
      } else {
        toast.error(data.error || "Failed to update profile")
      }
    } catch (error) {
      toast.error("An error occurred while updating profile")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match")
      setIsLoading(false)
      return
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Password changed successfully!")
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
      } else {
        toast.error(data.error || "Failed to change password")
      }
    } catch (error) {
      toast.error("An error occurred while changing password")
    } finally {
      setIsLoading(false)
    }
  }

  const uploadAvatar = async (picked: File) => {
    setUploadingAvatar(true)
    try {
      const { file } = await resizeImageFile(picked, 512)

      const body = new FormData()
      body.append("avatar", file)
      const res = await fetch("/api/profile/avatar", { method: "POST", body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not upload the picture")

      const newAvatarPath = data.avatar || ""
      setAvatarUrl(newAvatarPath)
      setProfileData((prev) => ({ ...prev, avatar: newAvatarPath }))
      // Keep external URL field clean so local file path is never entered into a URL text field
      setExternalUrl("")
      setAvatarMode("upload")
      await update({ image: newAvatarPath })
      toast.success("Profile picture uploaded successfully")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const removeAvatar = async () => {
    setUploadingAvatar(true)
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not remove the picture")
      setAvatarUrl("")
      setExternalUrl("")
      setProfileData((prev) => ({ ...prev, avatar: "" }))
      await update({ image: null })
      toast.success("Profile picture removed")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
      uploadAvatar(file)
    } else if (file) {
      toast.error("Please drop a PNG, JPEG, or WebP image file")
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentDisplayAvatar = avatarUrl || profileData.avatar

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Manage your personal profile information, avatar image, and account security credentials."
        badge={
          <Badge variant="secondary" className="font-normal text-xs">
            {userRole || (session.user as any)?.role || "User"}
          </Badge>
        }
      />

      <div className="max-w-2xl space-y-6">
        {/* Top User Overview Summary */}
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="relative">
            <label
              className="group block cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-ring"
              title="Click to change profile picture"
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Upload a profile picture"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadAvatar(file)
                  e.target.value = ""
                }}
              />
              <Avatar className="h-16 w-16 border shadow-sm">
                <AvatarImage src={currentDisplayAvatar || undefined} alt={profileData.name || "User"} />
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {profileData.name?.[0]?.toUpperCase() || session.user.name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {uploadingAvatar ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="size-5" aria-hidden="true" />
                )}
              </span>
            </label>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">{profileData.name || session.user.name}</h2>
            <p className="text-sm text-muted-foreground">{profileData.email || session.user.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {userRole || (session.user as any)?.role || "Standard Access"}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs gap-1.5"
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark"
                  setTheme(next)
                  toast.success(`Switched to ${next} mode`)
                }}
                title="Toggle light / dark mode"
              >
                {mounted && theme === "dark" ? (
                  <>
                    <Sun className="size-3 text-amber-500" />
                    <span>Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="size-3 text-indigo-400" />
                    <span>Light Mode</span>
                  </>
                )}
              </Button>
              {currentDisplayAvatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={removeAvatar}
                  disabled={uploadingAvatar}
                >
                  Remove picture
                </Button>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-sm">
            <TabsTrigger value="profile" className="gap-2">
              <User className="size-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-2">
              <ShieldCheck className="size-3.5" />
              Password
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Sun className="size-3.5 dark:hidden" />
              <Moon className="size-3.5 hidden dark:inline" />
              Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile Information</CardTitle>
                <CardDescription>Update your personal information and profile picture</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  {/* Profile Picture / Avatar Section */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Profile Picture / Avatar</Label>
                      <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
                        <button
                          type="button"
                          onClick={() => setAvatarMode("upload")}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                            avatarMode === "upload"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => setAvatarMode("url")}
                          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                            avatarMode === "url"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Web URL
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                      {/* Avatar Preview Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-14 w-14 border shadow-sm flex-shrink-0">
                            <AvatarImage src={currentDisplayAvatar || undefined} alt="Preview" />
                            <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
                              {profileData.name?.[0]?.toUpperCase() || session.user.name?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {currentDisplayAvatar ? "Active Profile Picture" : "No Profile Picture Set"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {currentDisplayAvatar?.startsWith("/uploads/")
                                ? "Uploaded from your computer"
                                : currentDisplayAvatar?.startsWith("http")
                                ? "Loaded from web URL"
                                : "Choose an image from your device or paste a URL"}
                            </p>
                          </div>
                        </div>

                        {currentDisplayAvatar && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={uploadingAvatar}
                            onClick={removeAvatar}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 self-start sm:self-auto"
                          >
                            <Trash2 className="size-4" />
                            Remove Picture
                          </Button>
                        )}
                      </div>

                      {/* Mode A: Upload File */}
                      {avatarMode === "upload" && (
                        <div
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          className={`rounded-lg border p-4 text-center space-y-2 transition-colors ${
                            isDragging
                              ? "border-primary bg-primary/5 border-dashed"
                              : "border-dashed border-border/80 bg-background/60 hover:bg-background"
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) uploadAvatar(file)
                              e.target.value = ""
                            }}
                          />
                          <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                            <Upload className="size-5 text-muted-foreground" />
                            <p className="text-xs font-medium text-foreground">
                              Drag & drop image here or click to browse
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Supports PNG, JPG, or WebP (max 3MB)
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingAvatar}
                              onClick={() => fileInputRef.current?.click()}
                              className="mt-1 gap-2"
                            >
                              {uploadingAvatar ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Upload className="size-4" />
                              )}
                              {currentDisplayAvatar ? "Choose New Image" : "Select Image to Upload"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Mode B: Web URL */}
                      {avatarMode === "url" && (
                        <div className="space-y-1.5 pt-1">
                          <Label htmlFor="avatar-url" className="text-xs font-medium">
                            Image URL
                          </Label>
                          <Input
                            id="avatar-url"
                            type="text"
                            value={externalUrl}
                            onChange={(e) => {
                              const val = e.target.value
                              setExternalUrl(val)
                              setAvatarUrl(val)
                              setProfileData((prev) => ({ ...prev, avatar: val }))
                            }}
                            placeholder="https://example.com/avatar.jpg"
                            className="bg-background text-sm"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Enter a direct public image link (HTTP or HTTPS).
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interface Theme Option */}
                  <div className="space-y-2 pt-2 border-t border-border/70">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Interface Theme</Label>
                      <span className="text-xs text-muted-foreground capitalize">
                        Active: {mounted ? theme : "light"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("light")
                          toast.success("Switched to Light theme")
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                          mounted && theme === "light"
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Sun className="size-3.5 text-amber-500" />
                        <span>Light</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("dark")
                          toast.success("Switched to Dark theme")
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                          mounted && theme === "dark"
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Moon className="size-3.5 text-indigo-400" />
                        <span>Dark</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTheme("system")
                          toast.success("Switched to System theme")
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                          mounted && theme === "system"
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Laptop className="size-3.5 text-muted-foreground" />
                        <span>System</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/dashboard")}
                      className="flex-1"
                    >
                      Back to Dashboard
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading || uploadingAvatar}
                      className="flex-1"
                    >
                      {isLoading ? "Saving Changes..." : "Save Profile Changes"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Change Password</CardTitle>
                <CardDescription>Update your account security password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder="Enter your current password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Re-type new password"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/dashboard")}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Appearance & Theme Preferences</CardTitle>
                <CardDescription>
                  Choose how Agency ERP looks for you. Your theme selection applies across all modules and pages immediately.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Light Mode Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("light")
                      toast.success("Theme changed to Light mode")
                    }}
                    className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group cursor-pointer ${
                      mounted && theme === "light"
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/40 bg-card hover:bg-muted/20"
                    }`}
                  >
                    <div className="w-full h-24 rounded-lg bg-[#f8fafc] border border-slate-200 p-2.5 flex flex-col justify-between shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="size-2 rounded-full bg-red-400" />
                          <div className="size-2 rounded-full bg-amber-400" />
                          <div className="size-2 rounded-full bg-emerald-400" />
                        </div>
                        <div className="h-1.5 w-8 rounded-full bg-slate-300" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-3/4 rounded bg-slate-300" />
                        <div className="h-2 w-1/2 rounded bg-slate-200" />
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <Sun className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Light Mode</p>
                          <p className="text-[11px] text-muted-foreground">Crisp & daytime</p>
                        </div>
                      </div>
                      {mounted && theme === "light" && (
                        <Badge variant="default" className="text-[10px] h-5 px-1.5 font-normal">Active</Badge>
                      )}
                    </div>
                  </button>

                  {/* Dark Mode Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("dark")
                      toast.success("Theme changed to Dark mode")
                    }}
                    className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group cursor-pointer ${
                      mounted && theme === "dark"
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/40 bg-card hover:bg-muted/20"
                    }`}
                  >
                    <div className="w-full h-24 rounded-lg bg-[#0f172a] border border-slate-800 p-2.5 flex flex-col justify-between shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="size-2 rounded-full bg-red-500/80" />
                          <div className="size-2 rounded-full bg-amber-500/80" />
                          <div className="size-2 rounded-full bg-emerald-500/80" />
                        </div>
                        <div className="h-1.5 w-8 rounded-full bg-slate-700" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-3/4 rounded bg-slate-700" />
                        <div className="h-2 w-1/2 rounded bg-slate-800" />
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <Moon className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Dark Mode</p>
                          <p className="text-[11px] text-muted-foreground">Low-glare contrast</p>
                        </div>
                      </div>
                      {mounted && theme === "dark" && (
                        <Badge variant="default" className="text-[10px] h-5 px-1.5 font-normal">Active</Badge>
                      )}
                    </div>
                  </button>

                  {/* System Default Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme("system")
                      toast.success("Theme changed to System default")
                    }}
                    className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group cursor-pointer ${
                      mounted && theme === "system"
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/40 bg-card hover:bg-muted/20"
                    }`}
                  >
                    <div className="w-full h-24 rounded-lg overflow-hidden border border-border flex shadow-inner">
                      <div className="w-1/2 bg-[#f8fafc] p-2 flex flex-col justify-between border-r border-slate-200">
                        <div className="size-1.5 rounded-full bg-slate-300" />
                        <div className="h-1.5 w-3/4 rounded bg-slate-300" />
                      </div>
                      <div className="w-1/2 bg-[#0f172a] p-2 flex flex-col justify-between">
                        <div className="size-1.5 rounded-full bg-slate-700 self-end" />
                        <div className="h-1.5 w-3/4 rounded bg-slate-700 self-end" />
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <Laptop className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">System Default</p>
                          <p className="text-[11px] text-muted-foreground">Auto OS match</p>
                        </div>
                      </div>
                      {mounted && theme === "system" && (
                        <Badge variant="default" className="text-[10px] h-5 px-1.5 font-normal">Active</Badge>
                      )}
                    </div>
                  </button>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/80 p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
                  <Check className="size-4 text-primary shrink-0" />
                  <span>
                    Your preference is saved locally on your device and will be remembered every time you log in.
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
