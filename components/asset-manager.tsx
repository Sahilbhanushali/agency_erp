"use client";
import toast from "react-hot-toast";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  MoreHorizontal,
  Grid3X3,
  List,
  Play,
  FileText,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

interface Asset {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
  post?: {
    id: string;
    title: string;
    status: string;
    project: {
      id: string;
      name: string;
      client: {
        id: string;
        name: string;
      };
    };
  } | null;
}

interface AssetManagerProps {
  assets: Asset[];
  isAdmin: boolean;
}

export function AssetManager({ assets: initialAssets, isAdmin }: AssetManagerProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filteredAssets = assets.filter((asset) =>
    asset.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.post?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.post?.project.client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = async (asset: Asset) => {
    try {
      const response = await fetch(`/api/assets/${asset.id}/download`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = asset.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast(`${asset.filename} is being downloaded.`);
    } catch (error) {
      toast.error("Failed to download the asset. Please try again.");
    }
  };

  const handleView = (asset: Asset) => {
    if (asset.type === "IMAGE") {
      window.open(asset.url, "_blank");
    } else {
      toast("Preview is only available for images.");
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete assets.");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Delete failed");
      }

      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setAssetToDelete(null);

      // Remove from selected assets if it was selected
      setSelectedAssets((prev) => {
        const newSet = new Set(prev);
        newSet.delete(asset.id);
        return newSet;
      });

      toast(`${asset.filename} has been deleted successfully.`);
    } catch (error) {
      toast.error("Delete Failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin || selectedAssets.size === 0) return;

    setIsBulkDeleting(true);
    try {
      const response = await fetch("/api/assets/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: Array.from(selectedAssets),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Bulk delete failed");
      }

      const result = await response.json();

      // Remove deleted assets from state
      setAssets((prev) => prev.filter((asset) => !selectedAssets.has(asset.id)));
      setSelectedAssets(new Set());
      setShowBulkDeleteDialog(false);

      toast(`Successfully deleted ${result.deletedCount} assets.`);
    } catch (error) {
      toast.error("Bulk Delete Failed");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const toggleAllAssets = () => {
    if (selectedAssets.size === filteredAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredAssets.map((asset) => asset.id)));
    }
  };

  const clearSelection = () => {
    setSelectedAssets(new Set());
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "IMAGE":
        return <ImageIcon className="h-4 w-4" />;
      case "VIDEO":
        return <Play className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const AssetCard = ({ asset }: { asset: Asset }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group relative">
      {isAdmin && (
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={selectedAssets.has(asset.id)}
            onCheckedChange={() => toggleAssetSelection(asset.id)}
            className="bg-card border-border"
          />
        </div>
      )}
      <CardContent className="p-4">
        <div className="aspect-square mb-3 relative overflow-hidden rounded-lg bg-muted">
          {asset.type === "IMAGE" ? (
            <img
              src={asset.url}
              alt={asset.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              {getAssetIcon(asset.type)}
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleView(asset)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleDownload(asset)}
            >
              <Download className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setAssetToDelete(asset)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm truncate">{asset.filename}</h3>
            <Badge variant="secondary" className="text-xs">
              {asset.type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {(asset.size / 1024 / 1024).toFixed(1)} MB
          </p>
          {asset.post ? (
            <div className="space-y-1">
              <p className="text-xs font-medium truncate">{asset.post.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {asset.post.project.client.name}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No associated post</p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Date(asset.createdAt).toLocaleDateString('en-GB')}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* Search and View Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input aria-label="Search assets"
                  placeholder="Search assets..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4 mr-2" />
                Table
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Grid
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {isAdmin && selectedAssets.size > 0 && (
        <Card className="border-orange-900 bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {selectedAssets.size} asset{selectedAssets.size !== 1 ? "s" : ""} selected
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={isBulkDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Assets ({filteredAssets.length})</h2>
            {isAdmin && <Badge variant="secondary">Admin View</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredAssets.length > 0 && selectedAssets.size === filteredAssets.length}
                        onCheckedChange={toggleAllAssets}
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Associated Post</TableHead>
                  <TableHead>Client/Project</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id} className="hover:bg-muted/50">
                    {isAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selectedAssets.has(asset.id)}
                          onCheckedChange={() => toggleAssetSelection(asset.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={asset.type === "IMAGE" ? asset.url : undefined} alt={asset.filename} />
                        <AvatarFallback className="text-xs">
                          {asset.type === "IMAGE" ? "IMG" : asset.type === "VIDEO" ? "VID" : "FILE"}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{asset.filename}</p>
                        <p className="text-xs text-muted-foreground">ID: {asset.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {asset.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{(asset.size / 1024 / 1024).toFixed(1)} MB</TableCell>
                    <TableCell>
                      {asset.post ? (
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{asset.post.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {asset.post.status}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No post</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {asset.post?.project ? (
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{asset.post.project.client.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.post.project.name}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(asset.createdAt).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(asset)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(asset)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setAssetToDelete(asset)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {filteredAssets.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No assets found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? `No assets match "${searchTerm}"` : "No assets available"}
            </p>
            {searchTerm && (
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={!!assetToDelete} onOpenChange={() => setAssetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetToDelete?.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => assetToDelete && handleDelete(assetToDelete)}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Assets</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedAssets.size} selected asset{selectedAssets.size !== 1 ? "s" : ""}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Deleting..." : `Delete ${selectedAssets.size} Assets`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}