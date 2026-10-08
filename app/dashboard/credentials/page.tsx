"use client"
import toast from "react-hot-toast";

import { useState, useEffect } from "react"
import { CredentialFormDialog } from "@/components/credentials/credential-form-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Eye, EyeOff, Edit, Trash2, Download, Upload } from "lucide-react"
import * as XLSX from 'xlsx'
export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/credentials")
      if (res.ok) {
        const data = await res.json()
        setCredentials(data)
      }
    } catch (err) {
      console.error("Error fetching credentials:", err)
    }
  }

  useEffect(() => {
    fetchCredentials()
  }, [])

  const handleSave = async (data: any) => {
    try {
      if (editData) {
        // Edit mode (PUT)
        const platformData = data.platforms[0] // Only 1 platform in edit mode
        const res = await fetch(`/api/credentials/${editData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: data.location,
            platform: platformData.platform,
            userId: platformData.userId,
            password: platformData.password,
          })
        })
        if (res.ok) {
          toast.success("Credential updated successfully!")
          fetchCredentials()
        }
      } else {
        // Add mode (POST)
        const res = await fetch(`/api/credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        if (res.ok) {
          toast.success("Credentials created successfully!")
          fetchCredentials()
        }
      }
    } catch (err) {
      console.error(err)
      toast.error("Something went wrong.")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credential?")) return;
    try {
      const res = await fetch(`/api/credentials/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success("Credential deleted successfully!")
        fetchCredentials()
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete credential.")
    }
  }

  const handleEditClick = (cred: any) => {
    setEditData(cred)
    setIsDialogOpen(true)
  }

  const handleAddNewClick = () => {
    setEditData(null)
    setIsDialogOpen(true)
  }

  const filteredCredentials = credentials.filter(c => 
    c.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.platform?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.userId?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleExport = () => {
    const exportData = credentials.map(cred => ({
      "Client Name": cred.client?.name || "",
      "Project Name": cred.project?.name || "",
      "Location": cred.location || "",
      "Contact Number": cred.client?.phone || "-",
      "Platform": cred.platform,
      "User Id": cred.userId,
      "Password": cred.password
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Credentials");
    XLSX.writeFile(workbook, "Credentials_Export.xlsx");
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Post data to bulk import endpoint
        const res = await fetch("/api/credentials/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.errors && resData.errors.length > 0) {
            toast.success(`Imported ${resData.count} credentials. Some rows failed.`);
            console.warn("Import errors:", resData.errors);
          } else {
            toast.success("Bulk import completed successfully!");
          }
          fetchCredentials();
        } else {
          const errorData = await res.json();
          console.error("Import failed:", errorData.details || errorData);
          toast.error(`Import failed: ${errorData.details?.[0] || 'Check the Excel format.'}`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = "";
  }

  const groupedCredentials: any[] = Object.values(
    filteredCredentials.reduce((acc, cred) => {
      const key = `${cred.clientId}-${cred.projectId}-${cred.location}`;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          clientName: cred.client?.name || "Unknown Client",
          projectName: cred.project?.name || "Unknown Project",
          location: cred.location || "-",
          phone: cred.client?.phone || "-",
          platforms: []
        };
      }
      acc[key].platforms.push(cred);
      return acc;
    }, {} as Record<string, any>)
  );

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Password Credentials</h1>
          <p className="text-muted-foreground mt-1">Manage client and project platform credentials securely.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="border-border">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleImport} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Import Excel"
            />
            <Button variant="outline" className="border-border w-full">
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
          </div>
          <Button onClick={handleAddNewClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Add Credential
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <div className="flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2 border border-border w-full max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients or projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-2 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="font-semibold text-foreground">Client Name</TableHead>
                  <TableHead className="font-semibold text-foreground">Project Name</TableHead>
                  <TableHead className="font-semibold text-foreground">Location</TableHead>
                  <TableHead className="font-semibold text-foreground">Contact Number</TableHead>
                  <TableHead className="font-semibold text-foreground">Platform</TableHead>
                  <TableHead className="font-semibold text-foreground">User Id</TableHead>
                  <TableHead className="font-semibold text-foreground">Password</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedCredentials.length > 0 ? groupedCredentials.map((group: any) => (
                  <TableRow key={group.id} className="border-border hover:bg-muted/20">
                    <TableCell className="font-medium align-top py-4">{group.clientName}</TableCell>
                    <TableCell className="align-top py-4">{group.projectName}</TableCell>
                    <TableCell className="text-muted-foreground align-top py-4">{group.location}</TableCell>
                    <TableCell className="text-muted-foreground align-top py-4">{group.phone}</TableCell>
                    <TableCell className="align-top py-4">
                      <div className="flex flex-col gap-3">
                        {group.platforms.map((p: any) => (
                          <div key={p.id} className="h-10 flex items-center">
                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-md">
                              {p.platform}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm align-top py-4">
                      <div className="flex flex-col gap-3">
                        {group.platforms.map((p: any) => (
                          <div key={p.id} className="h-10 flex items-center">
                            {p.userId}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <div className="flex flex-col gap-3">
                        {group.platforms.map((p: any) => (
                          <div key={p.id} className="h-10 flex items-center gap-2">
                            <Input 
                              type={visiblePasswords[p.id] ? "text" : "password"} 
                              value={p.password} 
                              readOnly 
                              className="h-8 w-32 bg-transparent border-border text-sm font-mono"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                              onClick={() => togglePasswordVisibility(p.id)}
                            >
                              {visiblePasswords[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top py-4">
                      <div className="flex flex-col gap-3">
                        {group.platforms.map((p: any) => (
                          <div key={p.id} className="h-10 flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(p)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 shrink-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No credentials found. Click "Add Credential" to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CredentialFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        onSave={handleSave}
        editData={editData}
      />
    </div>
  )
}
