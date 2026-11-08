
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MediaRenderer from "@/components/MediaRenderer";

interface Post {
  id: string;
  assets: Array<{ id: string; filename: string; url: string; contentType?: string }>;
}

interface VideoPopupProps {
  videoPopup: { postId: string; assetId: string } | null;
  setVideoPopup: (value: { postId: string; assetId: string } | null) => void;
  posts: Post[];
}

export default function VideoPopup({ videoPopup, setVideoPopup, posts }: VideoPopupProps) {
  const post = videoPopup ? posts.find((p) => p.id === videoPopup.postId) : null;
  const asset = post?.assets.find((a) => a.id === videoPopup?.assetId);

  return (
    <Dialog open={videoPopup !== null} onOpenChange={() => setVideoPopup(null)}>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="sr-only">Video Popup</DialogTitle>
        <div className="space-y-4">
          {asset ? (
            <div className="aspect-video rounded overflow-hidden">
              <MediaRenderer asset={asset} controls={true} />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Video not found</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setVideoPopup(null)} className="h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
