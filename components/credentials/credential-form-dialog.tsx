"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Suggestions only — the field is free text. A fixed list is why this module could not
 * hold a mailbox, a hosting panel or a bank login.
 */
const PLATFORM_SUGGESTIONS = [
  "Instagram", "Facebook", "X / Twitter", "LinkedIn", "YouTube", "Pinterest", "TikTok",
  "Gmail", "Google Workspace", "Outlook", "Zoho Mail",
  "WordPress", "Shopify", "Webflow", "cPanel", "Hostinger", "GoDaddy", "Cloudflare",
  "AWS", "Google Cloud", "DigitalOcean", "GitHub", "Vercel",
  "Figma", "Canva", "Adobe Creative Cloud", "Notion", "Slack",
  "Razorpay", "Stripe", "Net banking", "GST portal", "Income Tax portal",
]

/** Starting points for the Category field, which is also free text. */
const CATEGORY_SUGGESTIONS = [
  "Website", "Software / App", "Email", "Social media", "Hosting & domains",
  "Cloud & servers", "Design tools", "Payments & banking", "Statutory portals", "Internal",
]

interface CredentialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (data: any) => void
  editData?: any
  /** Existing categories, offered as suggestions without restricting the field. */
  categories?: string[]
}

export function CredentialFormDialog({
  open,
  onOpenChange,
  onSave,
  editData,
  categories = [],
}: CredentialFormDialogProps) {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const isEditMode = !!editData;
  
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    register,
    formState: { errors },
  } = useForm({
    defaultValues: {
      label: "",
      category: "",
      url: "",
      clientId: "",
      projectId: "",
      phone: "",
      location: "",
      platforms: [{ platform: "", userId: "", password: "" }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "platforms"
  })

  useEffect(() => {
    if (open) {
      // Fetch clients on open
      fetch("/api/clients")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setClients(data)
            
            if (editData) {
              const client = data.find(c => c.id === editData.clientId) || data.find(c => c.id.toString() === editData.clientId);
              setSelectedClient(client || null);
              
              reset({
                label: editData.label || "",
                category: editData.category || "",
                url: editData.url || "",
                clientId: editData.clientId?.toString() || "",
                projectId: editData.projectId?.toString() || "",
                phone: client?.phone || "",
                location: editData.location || "",
                platforms: [{
                  platform: editData.platform || "",
                  userId: editData.userId || "",
                  password: editData.password || ""
                }]
              });
            }
          }
        })
        .catch(err => console.error("Failed to fetch clients", err))
    } else {
      if (!isEditMode) reset()
      setSelectedClient(null)
    }
  }, [open, reset, editData, isEditMode])

  // Watch clientId to auto-fill phone number
  const clientId = watch("clientId")
  useEffect(() => {
    if (clientId && clients.length > 0) {
      const isOriginalClient = editData && clientId === editData.clientId?.toString();
      
      const client = clients.find(c => c.id.toString() === clientId)
      if (client) {
        setSelectedClient(client)
        if (!isOriginalClient) {
          setValue("phone", client.phone || "")
          // Reset project if client changes manually
          setValue("projectId", "")
        } else if (isOriginalClient && editData) {
           // Ensure project is correctly set if it was lost
           setValue("projectId", editData.projectId?.toString() || "")
        }
      }
    }
  }, [clientId, clients, setValue, editData])

  const onSubmit = (data: any) => {
    if (onSave) {
      onSave(data)
    }
    console.log("Submitting:", data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit credential" : "Add credential"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the details for this credential."
              : "For a client\u2019s platform, or an internal agency login \u2014 leave the client blank for internal."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4" autoComplete="off">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* What this login is for. Required, because "Instagram" alone does not say
                whose Instagram, and internal credentials have no client to lean on. */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="label">What is this for? *</Label>
              <Input
                id="label"
                {...register("label", { required: true })}
                placeholder="e.g. AWS root account, or Acme Instagram"
              />
              {errors.label && (
                <p className="text-xs text-destructive">Say what this login is for</p>
              )}
            </div>

            {/* Free text, not a fixed list: new kinds of credential appear often. */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                {...register("category")}
                list="credential-categories"
                placeholder="Website, Email, Hosting, Banking\u2026"
              />
              {/* Existing categories first, then the defaults, de-duplicated. */}
              <datalist id="credential-categories">
                {Array.from(new Set([...categories, ...CATEGORY_SUGGESTIONS])).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <datalist id="platform-suggestions">
                {PLATFORM_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" {...register("url")} placeholder="https://\u2026" />
            </div>
            {/* Client Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="clientId">Client <span className="text-muted-foreground">(leave blank for internal)</span></Label>
              <Controller
                name="clientId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger aria-label="Select Client" className="w-full">
                      <SelectValue placeholder="Select Client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Project Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!selectedClient || !selectedClient.projects?.length}
                  >
                    <SelectTrigger aria-label="Select Project" className="w-full">
                      <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedClient?.projects?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Phone Number (Auto-populated) */}
            <div className="space-y-2">
              <Label htmlFor="phone">Contact Number</Label>
              <Input 
                id="phone" 
                {...register("phone")} 
                placeholder="Auto-fetched or enter manually" 
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location" 
                {...register("location")} 
                placeholder="e.g. New York, USA" 
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold">Platform Credentials</h3>
              {!isEditMode && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => append({ platform: "", userId: "", password: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Platform
                </Button>
              )}
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end bg-muted/30 p-3 rounded-lg border border-border">
                <div className="flex-1 w-full space-y-1">
                  <Label className="text-xs" htmlFor={`platform-${index}`}>
                    Platform / service
                  </Label>
                  <Input
                    id={`platform-${index}`}
                    className="h-9 w-full"
                    list="platform-suggestions"
                    placeholder="Gmail, cPanel, Figma, Net banking…"
                    {...register(`platforms.${index}.platform`, { required: true })}
                  />
                </div>
                
                <div className="flex-1 w-full space-y-1">
                  <Label className="text-xs">Username / email</Label>
                  <Input aria-label="Username / email"
                    type="text"
                    {...register(`platforms.${index}.userId`, { required: true })} 
                    placeholder="Username/Email"
                    className="h-9"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex-1 w-full space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input aria-label="Password" 
                    type="password"
                    {...register(`platforms.${index}.password`, { required: true })} 
                    placeholder="Password"
                    className="h-9"
                    autoComplete="new-password"
                  />
                </div>

                {!isEditMode && (
                  <Button aria-label="Remove this credential row" 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{isEditMode ? "Update Credential" : "Save Credential"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
