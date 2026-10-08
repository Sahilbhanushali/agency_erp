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

const PLATFORMS = ["Instagram", "Facebook", "Twitter", "LinkedIn", "Youtube", "Pinterest"]

interface CredentialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (data: any) => void
  editData?: any
}

export function CredentialFormDialog({ open, onOpenChange, onSave, editData }: CredentialFormDialogProps) {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const isEditMode = !!editData;
  
  const { control, handleSubmit, watch, setValue, reset, register } = useForm({
    defaultValues: {
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
          <DialogTitle>{isEditMode ? "Edit Password Credential" : "Add Password Credential"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the details for this platform credential." : "Add a new credential for a client's project platforms."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4" autoComplete="off">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="clientId">Client</Label>
              <Controller
                name="clientId"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full">
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
                rules={{ required: true }}
                render={({ field }) => (
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!selectedClient || !selectedClient.projects?.length}
                  >
                    <SelectTrigger className="w-full">
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
                {...register("location", { required: true })} 
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
                  <Label className="text-xs">Platform</Label>
                  <Controller
                    name={`platforms.${index}.platform`}
                    control={control}
                    rules={{ required: true }}
                    render={({ field: selectField }) => (
                      <Select onValueChange={selectField.onChange} value={selectField.value}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map(p => (
                            <SelectItem key={p} value={p.toUpperCase()}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                
                <div className="flex-1 w-full space-y-1">
                  <Label className="text-xs">User ID</Label>
                  <Input 
                    type="email"
                    {...register(`platforms.${index}.userId`, { required: true })} 
                    placeholder="Username/Email"
                    className="h-9"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex-1 w-full space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input 
                    type="password"
                    {...register(`platforms.${index}.password`, { required: true })} 
                    placeholder="Password"
                    className="h-9"
                    autoComplete="new-password"
                  />
                </div>

                {!isEditMode && (
                  <Button 
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
