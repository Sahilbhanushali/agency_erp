"use client";

import type React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, X } from "lucide-react"
import Link from "next/link"
import toast, { Toaster } from "react-hot-toast" // react-hot-toast

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
      toast.error("Please enter a valid email address (e.g. user@example.com). It cannot end with numbers or invalid extensions.");
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
    <>
      {/* Toast container – can be moved to root layout */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: "#363636", color: "#fff" },
          success: { style: { background: "#10b981" } },
          error: { style: { background: "#ef4444" } },
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard/clients">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <CardTitle>{client ? "Edit Client" : "New Client"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$"
                  title="Please enter a valid email address (e.g. user@example.com)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setFormData({ ...formData, phone: value });
                  }}
                  maxLength={10}
                  pattern="^(?!([0-9])\1{9})[0-9]{10}$"
                  title="Phone number must be exactly 10 digits and cannot be all identical numbers (e.g. 1111111111)"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Logo / Avatar</Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => {
                  setAvatarFile(e.target.files?.[0] || null)
                  if (e.target.files?.[0]) setRemoveAvatar(false)
                }}
              />
              {previewUrl && (
                <div className="relative inline-block mt-4">
                  <img
                    src={previewUrl}
                    alt="Client Logo"
                    className="h-16 w-auto rounded border object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                    title="Remove Logo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Link href="/dashboard/clients">
                <Button variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : client ? "Update Client" : "Create Client"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}