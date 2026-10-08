import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import MediaRenderer from "@/components/MediaRenderer";

type PostStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SCHEDULED" | "POSTED";

interface Post {
  id: string;
  title: string;
  caption?: string;
  assets: Array<{ id: string; filename: string; url: string; contentType?: string; isReference?: boolean }>;
}

interface ApprovalDialogProps {
  approvalDialog: { postId: string; action: "approve" | "reject" } | null;
  setApprovalDialog: (value: { postId: string; action: "approve" | "reject" } | null) => void;
  posts: Post[];
  selectedAssets: string[];
  setSelectedAssets: (value: string[]) => void;
  actionComment: string;
  setActionComment: (value: string) => void;
  handleApprovalAction: () => void;
  handleVideoPlay: (postId: string, assetId: string) => void;
}

export default function ApprovalDialog({
  approvalDialog,
  setApprovalDialog,
  posts,
  selectedAssets,
  setSelectedAssets,
  actionComment,
  setActionComment,
  handleApprovalAction,
  handleVideoPlay,
}: ApprovalDialogProps) {
  return (
    <Dialog open={approvalDialog !== null} onOpenChange={() => setApprovalDialog(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{approvalDialog?.action === "approve" ? "Approve Post" : "Request Change"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {approvalDialog &&
            (() => {
              const post = posts.find((p) => p.id === approvalDialog.postId);
              return post ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">{post.title}</h4>
                    <p className="text-sm text-muted-foreground">{post.caption}</p>
                  </div>
                  {approvalDialog.action === "approve" && post.assets.length > 1 && (
                    <div>
                      <label className="text-sm font-medium">Select assets to approve:</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {post.assets
                          .filter((asset) => !asset.isReference) // Exclude assets where isReference is true
                          .map((asset) => (
                            <div key={asset.id} className="relative">
                              <div className="relative aspect-square rounded border overflow-hidden">
                                <MediaRenderer
                                  asset={asset}
                                  controls={false}
                                  onPlay={(assetId) => handleVideoPlay(post.id, assetId)}
                                />
                                <Checkbox
                                  checked={selectedAssets.includes(asset.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedAssets((prev) => [...prev, asset.id]);
                                    } else {
                                      setSelectedAssets((prev) => prev.filter((id) => id !== asset.id));
                                    }
                                  }}
                                  className="absolute top-2 left-2 bg-background/80"
                                />
                              </div>
                              <p className="text-xs text-center mt-1 truncate">{asset.filename}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">
                      {approvalDialog.action === "approve" ? "Approval notes (optional)" : "Change reason (Compulsory)"}
                    </label>
                    <Textarea
                      value={actionComment}
                      onChange={(e) => setActionComment(e.target.value)}
                      placeholder={
                        approvalDialog.action === "approve"
                          ? "Add any notes about the approval..."
                          : "Explain why this post is being rejected..."
                      }
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </div>
              ) : null;
            })()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setApprovalDialog(null)} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleApprovalAction}
            className={`h-8 text-xs ${
              approvalDialog?.action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {approvalDialog?.action === "approve" ? "Approve" : "Request Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}