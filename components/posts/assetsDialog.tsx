
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MediaRenderer from "@/components/MediaRenderer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import PostTimingBadge from "./postTimingBadge";

interface Post {
  id: string;
  title: string;
  scheduledAt?: string;
  assets: Array<{ id: string; filename: string; url: string; contentType?: string; isReference?: boolean; createdAt?: string | Date }>;
}

interface AssetsDialogProps {
  viewingAssets: string | null;
  setViewingAssets: (postId: string | null) => void;
  posts: Post[];
  handleVideoPlay: (postId: string, assetId: string) => void;
}

export default function AssetsDialog({
  viewingAssets,
  setViewingAssets,
  posts,
  handleVideoPlay,
}: AssetsDialogProps) {
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);

  const post = posts.find((p) => p.id === viewingAssets);
  const assets = post?.assets || [];

  const nextAsset = () => {
    setCurrentAssetIndex((prev) => (prev + 1) % assets.length);
  };

  const prevAsset = () => {
    setCurrentAssetIndex((prev) => (prev - 1 + assets.length) % assets.length);
  };

  return (
    <Dialog open={viewingAssets !== null} onOpenChange={() => setViewingAssets(null)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Post Assets: {post?.title}</span>
            {post && <PostTimingBadge post={post} />}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {assets.length > 0 ? (
            <div className="relative">
              <div className="aspect-video rounded overflow-hidden">
                <MediaRenderer
                  asset={assets[currentAssetIndex]}
                  controls={false}
                  onPlay={(assetId) => handleVideoPlay(post!.id, assetId)}
                />
              </div>
              {assets.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white"
                    onClick={prevAsset}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white"
                    onClick={nextAsset}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                    {currentAssetIndex + 1} / {assets.length}
                  </div>
                </>
              )}
              <p className="text-sm text-gray-600 mt-2 text-center">{assets[currentAssetIndex]?.filename}</p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No assets available</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setViewingAssets(null)} className="h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
