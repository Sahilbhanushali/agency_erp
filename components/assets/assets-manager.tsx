"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Search, Download, XCircle, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import MediaPopup from "../mediaPopup";
import { getMediaUrl } from "@/lib/utils";

// Type definitions
type Asset = {
  id: string;
  filename: string;
  url: string;
  type: string | null;
  size: number | null;
  order: number;
  createdAt: string;
  isReference: boolean;
  isEdited: boolean;
  postId: string;
  uploadedById: number;
  post: {
    id: string;
    title: string;
    status: string;
    contentStatus: string;
    project: {
      id: string;
      name: string;
      client: {
        id: string;
        name: string;
        company: string;
        avatar?: string | null;
      };
    };
  };
  uploadedBy: {
    id: number;
    name: string;
  } | null;
};

type AssetManagerProps = {
  assets: Asset[];
  hasManageAssetsPermission: boolean;
};

export function AssetManager({ assets, hasManageAssetsPermission }: AssetManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{
    url: string;
    filename: string;
    type: string;
  } | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Number of assets per page (3x3 grid = 9 assets)
  const assetsPerPage = 9;

  // Filter to only approved images with isEdited and isReference false
  const approvedImages = assets.filter(
    (asset) =>
      asset.type?.startsWith("image") &&
      asset.post.status === "APPROVED" &&
      !asset.isEdited &&
      !asset.isReference
  );

  // Get unique companies
  const uniqueCompanies = Array.from(
    new Set(approvedImages.map((asset) => asset.post.project.client.company))
  ).sort();

  // Apply search and company filters
  let displayedAssets = approvedImages;
  if (searchTerm) {
    displayedAssets = displayedAssets.filter(
      (asset) =>
        asset.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.post.project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.post.project.client.company
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
    );
  }
  if (selectedCompany && selectedCompany !== "all") {
    displayedAssets = displayedAssets.filter(
      (asset) => asset.post.project.client.company === selectedCompany
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(displayedAssets.length / assetsPerPage);
  const startIndex = (currentPage - 1) * assetsPerPage;
  const paginatedAssets = displayedAssets.slice(startIndex, startIndex + assetsPerPage);

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  // Handle download
  const handleDownload = (asset: Asset) => {
    const link = document.createElement("a");
    link.href = getMediaUrl(asset.url);
    link.download = asset.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle image error
  const handleImageError = (assetId: string) => {
    setImageErrors((prev) => ({ ...prev, [assetId]: true }));
  };

  // Handle asset click for popup
  const handleAssetClick = (asset: Asset) => {
    setSelectedAsset({
      url: getMediaUrl(asset.url),
      filename: asset.filename,
      type: asset.type || "image",
    });
    setIsPopupOpen(true);
  };

  // Handle delete
  const handleDelete = async (assetId: string) => {
    if (confirm("Are you sure you want to delete this asset? This action cannot be undone.")) {
      try {
        const response = await fetch(`/api/assets/${assetId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          window.location.reload();
        } else {
          alert("Failed to delete asset. Please try again.");
        }
      } catch (error) {
        console.error("Error deleting asset:", error);
        alert("Error deleting asset. Please check your connection and try again.");
      }
    }
  };

  // Handle pagination
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Asset Manager</h1>
          <p className="text-muted-foreground">Browse and manage your approved image assets</p>
        </div>

        {/* Filters */}
        <Card className="mb-8 bg-card border-border">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <Label className="block text-sm font-medium text-muted-foreground mb-2">
                  Search Assets
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search by filename, project, or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-muted/50 border-border focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex-1">
                <Label className="block text-sm font-medium text-muted-foreground mb-2">
                  Filter by Company
                </Label>
                <Select
                  value={selectedCompany || "all"}
                  onValueChange={(value) => setSelectedCompany(value === "all" ? null : value)}
                >
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all" className="text-foreground">All Companies</SelectItem>
                    {uniqueCompanies.map((company) => (
                      <SelectItem key={company} value={company} className="text-foreground">
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {paginatedAssets.length} of {displayedAssets.length} images
                {selectedCompany && selectedCompany !== "all" && ` from ${selectedCompany}`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Asset Grid */}
        {paginatedAssets.length === 0 ? (
          <Card className="p-12 text-center bg-card border-border">
            <CardContent>
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No images found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria or filters</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-6">
              {paginatedAssets.map((asset) => (
                <Card
                  key={asset.id}
                  className="w-full transition-all duration-200 hover:shadow-lg border border-border bg-card"
                >
                  {/* Instagram-like header with client avatar and company */}
                  <div className="flex items-center px-3 pt-3 pb-2">
                    <img
                      src={asset.post.project.client.avatar || '/placeholder-client-logo.png'}
                      alt={`${asset.post.project.client.company} logo`}
                      className="w-8 h-8 rounded-full mr-2 object-cover"
                      onError={(e) => (e.currentTarget.src = '/placeholder-client-logo.png')}
                    />
                    <span className="font-semibold text-sm text-foreground truncate">
                      {asset.post.project.client.company}
                    </span>
                  </div>

                  {/* Image Container */}
                  <div
                    className="relative aspect-square cursor-pointer"
                    onClick={() => handleAssetClick(asset)}
                  >
                    {imageErrors[asset.id] ? (
                      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-red-950/20 to-red-900/30 border border-red-900 rounded">
                        <XCircle className="h-8 w-8 text-red-400 mb-2" />
                        <span className="text-red-400 text-sm font-medium">Failed to load image</span>
                        <span className="text-red-400 text-xs mt-1 truncate w-full px-2">{asset.filename}</span>
                      </div>
                    ) : (
                      <Image
                        src={getMediaUrl(asset.url)}
                        alt={asset.filename}
                        fill
                        className="object-cover"
                        quality={75}
                        sizes="(max-width: 640px) 100vw, 33vw"
                        onError={() => handleImageError(asset.id)}
                        unoptimized={asset.url.includes('blob:') || !asset.url.startsWith('http')}
                        priority={false}
                      />
                    )}
                    <Badge
                      className="absolute top-2 left-2 bg-green-950/30 text-green-400 border border-green-800 text-xs font-medium"
                    >
                      Approved
                    </Badge>
                  </div>

                  {/* Content */}
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <h3
                        className="font-semibold text-sm line-clamp-1 text-blue-400 cursor-pointer hover:underline"
                        title={asset.filename}
                      >
                        {asset.filename}
                      </h3>
                      <p className="text-xs text-muted-foreground">{formatFileSize(asset.size)}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{asset.post.project.name}</span>
                        <span>{formatDate(asset.createdAt)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Uploaded: {asset.uploadedBy?.name || "Unknown"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 text-green-400 border border-green-850 hover:bg-green-950/30"
                          onClick={() => handleDownload(asset)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </Button>
                        {hasManageAssetsPermission && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 text-red-400 border border-red-850 hover:bg-red-950/30"
                            onClick={() => handleDelete(asset.id)}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 border-border text-foreground hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 border-border text-foreground hover:bg-muted"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Media Popup */}
      <MediaPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        asset={selectedAsset}
      />
    </div>
  );
}