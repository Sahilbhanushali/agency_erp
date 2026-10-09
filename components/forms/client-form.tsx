"use client";

import type React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, X, Upload, User, Building } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

interface ClientFormProps {
  client?: {
    id: string
    name: string
    email: string
    phone?: string
    company?: string
    avatar?: string
  }
}

export function ClientForm({ client }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: client?.name || "",
    email: client?.email || "",
    phone: client?.phone || "",
    company: client?.company || "",
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRemoveImage = () => {
    setAvatarFile(null)
    setRemoveAvatar(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const previewUrl = avatarFile ? URL.createObjectURL(avatarFile) : (removeAvatar ? null : client?.avatar)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address (e.g. user@example.com).");
      return;
    }

    const phoneRegex = /^(?!([0-9])\1{9})[0-9]{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.error("Phone number must be exactly 10 digits and cannot be all identical numbers.");
      return;
    }

    setIsLoading(true)

    const url = client ? `/api/clients/${client.id}` : "/api/clients"
    const method = client ? "PUT" : "POST"

    const form = new FormData()
    form.append("name", formData.name)
    form.append("email", formData.email)
    form.append("phone", formData.phone)
    form.append("company", formData.company)
    if (avatarFile) {
      form.append("avatar", avatarFile)
    } else if (removeAvatar) {
      form.append("removeAvatar", "true")
    }

    try {
      const response = await fetch(url, { method, body: form })

      if (response.ok) {
        toast.success(client ? "Client updated successfully!" : "Client created successfully!")
        setTimeout(() => router.push("/dashboard/clients"), 800)
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to save client")
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-3xl mx-auto shadow-2xs">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground">
            <Link href="/dashboard/clients" title="Back to clients">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <CardTitle>{client ? "Edit Client" : "New Client Account"}</CardTitle>
            <CardDescription className="text-xs">
              {client ? "Update client contact information and organization details." : "Add a new client organization to manage campaigns and approvals."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <User className="size-3.5 text-primary" />
              <span>Contact Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Client Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="e.g. Acme Corp / Sarah Jenkins"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs font-medium">Company / Brand</Label>
                <Input
                  id="company"
                  placeholder="e.g. Acme Brands Inc."
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@client.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9 text-xs"
                  pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$"
                  title="Please enter a valid email address (e.g. user@example.com)"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium">Phone Number <span className="text-destructive">*</span></Label>
                <Input
                  id="phone"
                  placeholder="10-digit mobile number"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setFormData({ ...formData, phone: value });
                  }}
                  className="h-9 text-xs tabular-nums"
                  maxLength={10}
                  pattern="^(?!([0-9])\1{9})[0-9]{10}$"
                  title="Phone number must be exactly 10 digits"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Logo / Media */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              <Building className="size-3.5 text-primary" />
              <span>Branding & Logo</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar" className="text-xs font-medium">Client Logo / Avatar</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="h-9 text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    onChange={(e) => {
                      setAvatarFile(e.target.files?.[0] || null)
                      if (e.target.files?.[0]) setRemoveAvatar(false)
                    }}
                  />
                </div>
              </div>

              {previewUrl && (
                <div className="relative inline-flex items-center gap-3 mt-3 p-2 rounded-lg border border-border/60 bg-muted/20">
                  <img
                    src={previewUrl}
                    alt="Client Logo"
                    className="h-12 w-12 rounded-md object-cover border border-border"
                  />
                  <div className="text-xs">
                    <p className="font-medium text-foreground">Client Logo Preview</p>
                    <p className="text-[11px] text-muted-foreground">Will be shown on share portals and invoices</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleRemoveImage}
                    className="text-destructive hover:bg-destructive/10 ml-auto"
                    title="Remove Logo"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <Button asChild variant="outline" size="sm" disabled={isLoading}>
              <Link href="/dashboard/clients">Cancel</Link>
            </Button>
            <Button type="submit" size="sm" loading={isLoading}>
              {client ? "Update Client" : "Create Client"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}