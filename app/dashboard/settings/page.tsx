"use client"
import toast from "react-hot-toast";

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import { Plus, X, Trash2, Mail, Clock, Settings as SettingsIcon } from "lucide-react"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"

interface Utility {
  id: string
  name: string
  type: "PLATFORM" | "POST_TYPE"
  values: string[]
  createdAt: string
  updatedAt: string
}

export default function SettingsPage() {
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [loading, setLoading] = useState(true)
  const [newUtilityName, setNewUtilityName] = useState("")
  const [newUtilityType, setNewUtilityType] = useState<"PLATFORM" | "POST_TYPE">("PLATFORM")
  const [editingUtility, setEditingUtility] = useState<string | null>(null)
  const [newValue, setNewValue] = useState("")

  useEffect(() => {
    fetchUtilities()
  }, [])

  const fetchUtilities = async () => {
    try {
      const response = await fetch("/api/utilities")
      if (response.ok) {
        const data = await response.json()
        setUtilities(data)
      }
    } catch (error) {
      console.error("Failed to fetch utilities:", error)
      toast.error("Failed to load utilities")
    } finally {
      setLoading(false)
    }
  }

  const createUtility = async () => {
    if (!newUtilityName.trim()) return

    try {
      const response = await fetch("/api/utilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUtilityName,
          type: newUtilityType,
          values: [],
        }),
      })

      if (response.ok) {
        const newUtility = await response.json()
        setUtilities([...utilities, newUtility])
        setNewUtilityName("")
        toast.success("Utility created successfully")
      }
    } catch (error) {
      console.error("Failed to create utility:", error)
      toast.error("Failed to create utility")
    }
  }

  const addValue = async (utilityId: string) => {
    if (!newValue.trim()) return

    try {
      const utility = utilities.find((u) => u.id === utilityId)
      if (!utility) return

      const updatedValues = [...utility.values, newValue]

      const response = await fetch(`/api/utilities/${utilityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: updatedValues }),
      })

      if (response.ok) {
        const updatedUtility = await response.json()
        setUtilities(utilities.map((u) => (u.id === utilityId ? updatedUtility : u)))
        setNewValue("")
        toast.success("Value added successfully")
      }
    } catch (error) {
      console.error("Failed to add value:", error)
      toast.error("Failed to add value")
    }
  }

  const removeValue = async (utilityId: string, valueToRemove: string) => {
    try {
      const utility = utilities.find((u) => u.id === utilityId)
      if (!utility) return

      const updatedValues = utility.values.filter((v) => v !== valueToRemove)

      const response = await fetch(`/api/utilities/${utilityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: updatedValues }),
      })

      if (response.ok) {
        const updatedUtility = await response.json()
        setUtilities(utilities.map((u) => (u.id === utilityId ? updatedUtility : u)))
        toast.success("Value removed successfully")
      }
    } catch (error) {
      console.error("Failed to remove value:", error)
      toast.error("Failed to remove value")
    }
  }

  const [utilityToDelete, setUtilityToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingUtility, setIsDeletingUtility] = useState(false)

  const confirmDeleteUtility = async () => {
    if (!utilityToDelete) return
    setIsDeletingUtility(true)
    try {
      const response = await fetch(`/api/utilities/${utilityToDelete.id}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setUtilities(utilities.filter((u) => u.id !== utilityToDelete.id))
        toast.success(data.message || "Utility deleted successfully")
        setUtilityToDelete(null)
      } else {
        toast.error(data.error || "Failed to delete utility")
      }
    } catch (error: any) {
      console.error("Failed to delete utility:", error)
      toast.error(error.message || "Failed to delete utility")
    } finally {
      setIsDeletingUtility(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Card className="shadow-2xs">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-1/3 rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="System Settings"
        description="Configure taxonomy utilities, scheduled report emails, and email delivery credentials."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/settings/jobs">
            <Clock className="size-3.5" />
            Scheduled Jobs
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/settings/smtp">
            <Mail className="size-3.5" />
            SMTP Mail Settings
          </Link>
        </Button>
      </PageHeader>

      {/* Create New Utility */}
      <Card className="shadow-2xs border-border/70">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Create New Utility</CardTitle>
          <CardDescription className="text-xs">Add a custom categorization dimension to manage agency deliverables.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="utility-name" className="text-xs font-medium">Utility Name</Label>
              <Input
                id="utility-name"
                value={newUtilityName}
                onChange={(e) => setNewUtilityName(e.target.value)}
                placeholder="e.g. Social Platforms"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="utility-type" className="text-xs font-medium">Dimension Type</Label>
              <Select
                value={newUtilityType}
                onValueChange={(val) => setNewUtilityType(val as "PLATFORM" | "POST_TYPE")}
              >
                <SelectTrigger id="utility-type" className="h-9 text-xs bg-card">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLATFORM" className="text-xs">Platform (e.g. Instagram, LinkedIn)</SelectItem>
                  <SelectItem value="POST_TYPE" className="text-xs">Post Type (e.g. Reel, Carousel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={createUtility} size="sm" className="w-full h-9 gap-1.5">
                <Plus className="size-3.5" />
                Create Utility
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Utilities */}
      <div className="grid gap-6">
        {utilities.map((utility) => (
          <Card key={utility.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {utility.name}
                  <Badge variant={utility.type === "PLATFORM" ? "default" : "secondary"}>{utility.type}</Badge>
                </CardTitle>
                <CardDescription>
                  {utility.values.length} values • Created {new Date(utility.createdAt).toLocaleDateString('en-GB')}
                </CardDescription>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  setUtilityToDelete({
                    id: utility.id,
                    name: `${utility.name} (${utility.type})`,
                  })
                }
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Values Display */}
              <div className="flex flex-wrap gap-2">
                {utility.values.map((value, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {value}
                    <button onClick={() => removeValue(utility.id, value)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {utility.values.length === 0 && <p className="text-muted-foreground text-sm">No values added yet</p>}
              </div>

              {/* Add New Value */}
              <div className="flex gap-2">
                <Input
                  value={editingUtility === utility.id ? newValue : ""}
                  onChange={(e) => {
                    setNewValue(e.target.value)
                    setEditingUtility(utility.id)
                  }}
                  placeholder={`Add new ${utility.type.toLowerCase()} value...`}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      addValue(utility.id)
                      setEditingUtility(null)
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    addValue(utility.id)
                    setEditingUtility(null)
                  }}
                  disabled={!newValue.trim() || editingUtility !== utility.id}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {utilities.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No utilities created yet. Create your first utility above.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Alert */}
      <DeleteConfirmationDialog
        isOpen={!!utilityToDelete}
        onClose={() => setUtilityToDelete(null)}
        onConfirm={confirmDeleteUtility}
        itemName={utilityToDelete?.name || "Utility"}
        entityType="utility"
        isLoading={isDeletingUtility}
      />
    </div>
  )
}
