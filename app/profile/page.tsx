"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { Camera, Loader2 } from "lucide-react"
import { resizeImageFile } from "@/lib/resize-image"

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  /** The stored avatar path. `session.user.image` is only as fresh as the last sign-in. */
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
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
    if (session?.user) {
      setProfileData({
        name: session.user.name || "",
        email: session.user.email || "",
        avatar: session.user.image || "",
      })
      // Keep a just-uploaded picture rather than reverting to the session's older value.
      setAvatarUrl((current) => current || session.user.image || "")
    }
  }, [session])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Profile updated successfully!")
        await update({ name: profileData.name })
        setTimeout(() => {
          router.push("/dashboard")
        }, 1000)
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
        setTimeout(() => {
          router.push("/dashboard")
        }, 1000)
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
      // An avatar is never shown larger than a few dozen pixels, so sending a phone
      // photo at full resolution only wastes storage and bandwidth.
      const { file } = await resizeImageFile(picked, 512)

      const body = new FormData()
      body.append("avatar", file)
      const res = await fetch("/api/profile/avatar", { method: "POST", body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not upload the picture")
      setAvatarUrl(data.avatar)
      // Refresh the session so the sidebar avatar updates without a sign-out.
      await update({ image: data.avatar })
      toast.success("Profile picture updated")
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
      await update({ image: null })
      toast.success("Profile picture removed")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/*
            The avatar is a label wrapping a hidden file input, so clicking the picture
            itself opens the picker — there was previously no way at all to set one.
          */}
          <div className="relative">
            <label
              className="group block cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-ring"
              title="Change your profile picture"
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
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl || undefined} alt="" />
                <AvatarFallback>{session.user.name?.[0]?.toUpperCase()}</AvatarFallback>
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

          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{session.user.name}</h1>
            <p className="text-gray-600">{session.user.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{session.user.role ?? "No role"}</Badge>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={removeAvatar}
                  disabled={uploadingAvatar}
                >
                  Remove picture
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPEG or WebP, up to 3MB.
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avatar">Avatar URL</Label>
                    <Input
                      id="avatar"
                      type="url"
                      value={profileData.avatar}
                      onChange={(e) => setProfileData({ ...profileData, avatar: e.target.value })}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <Button type="button" variant="outline" onClick={() => router.push("/dashboard")} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? "Updating..." : "Update Profile"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
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
                      required
                    />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <Button type="button" variant="outline" onClick={() => router.push("/dashboard")} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? "Changing..." : "Change Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
