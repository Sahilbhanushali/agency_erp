"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Trash2, Volume2 } from "lucide-react";
import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { Post } from "@/types/post";

interface DesignerHeadApprovalRejectDialogProps {
  statusRejectDialog: { postId: string; statusType: "designerHead" } | null;
  setStatusRejectDialog: (value: { postId: string; statusType: "designerHead" } | null) => void;
  posts: Post[];
  actionComment: string;
  setActionComment: (value: string) => void;
  selectedDate: string;
  audioBlob: Blob | null;
  setAudioBlob: (value: Blob | null) => void;
  handleStatusReject: (statusType: "designerHead", audioBlob: Blob | null) => Promise<void>;
  targetStatus?: string;
}

export default function DesignerHeadApprovalRejectDialog({
  statusRejectDialog,
  setStatusRejectDialog,
  posts,
  actionComment,
  setActionComment,
  selectedDate,
  audioBlob,
  setAudioBlob,
  handleStatusReject,
  targetStatus,
}: DesignerHeadApprovalRejectDialogProps) {
  const post = posts.find((p) => p.id === statusRejectDialog?.postId);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  if (!statusRejectDialog || !post) return null;

  const isNeedsMinorChange = targetStatus === "NEEDS_MINOR_CHANGE";

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      setActionComment(
        actionComment
          ? `${actionComment}\n\n🎙️ Recording audio feedback...`
          : "🎙️ Recording audio feedback..."
      );

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setActionComment(
        actionComment.replace("🎙️ Recording audio feedback...", "🎙️ Audio feedback recorded")
      );
    }
  };

  const deleteAudio = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setActionComment(actionComment.replace(/🎙️.*audio feedback.*/gi, "").trim());
  };

  const handleSubmit = async () => {
    if (isNeedsMinorChange && !actionComment.trim()) {
      toast.error("Please provide text comment explaining the required minor change.");
      return;
    }
    if (!isNeedsMinorChange && !actionComment.trim() && !audioBlob) {
      toast.error("Please provide either text feedback or audio feedback");
      return;
    }

    setIsSubmitting(true);
    try {
      await handleStatusReject(statusRejectDialog.statusType, audioBlob);
      setStatusRejectDialog(null);
    } catch (error) {
      console.error("Error submitting Team Lead rejection:", error);
      toast.error("Failed to submit changes. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isSubmitDisabled = isSubmitting || (isNeedsMinorChange ? !actionComment.trim() : (!actionComment.trim() && !audioBlob));

  return (
    <Dialog
      open={statusRejectDialog !== null}
      onOpenChange={() => {
        setStatusRejectDialog(null);
        setAudioBlob(null);
        setActionComment("");
        setRecordingTime(0);
        if (isRecording) stopRecording();
      }}
    >
      <DialogContent className="max-w-lg bg-card rounded-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {isNeedsMinorChange ? `Request Minor Changes: ${post.title}` : `Reject Team Lead Approval: ${post.title}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 p-4">
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              Comment/Feedback {(isNeedsMinorChange || (!audioBlob && !isRecording)) && <span className="text-red-500">*</span>}
            </label>
            <Textarea aria-label="Comment/Feedback"
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder={isNeedsMinorChange ? "Specify what minor changes are required" : "Enter the reason for change"}
              className="h-24 resize-none border-border focus:ring-2 focus:ring-blue-500 rounded-lg"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">
              Audio Feedback (Optional)
            </label>
            <div className="space-y-4">
              {!audioBlob ? (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 ${
                      isRecording
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    } text-white shadow-lg hover:shadow-xl`}
                  >
                    {isRecording ? (
                      <>
                        <Square className="h-5 w-5" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-5 w-5" />
                        Start Recording
                      </>
                    )}
                    {isRecording && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1">
                        {formatTime(recordingTime)}
                      </div>
                    )}
                  </Button>
                  {isRecording && (
                    <div className="flex items-center gap-1">
                      <div className="h-8 w-2 bg-red-500 animate-wave1 rounded"></div>
                      <div className="h-8 w-2 bg-red-500 animate-wave2 rounded"></div>
                      <div className="h-8 w-2 bg-red-500 animate-wave3 rounded"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl shadow-md">
                  <Volume2 className="h-5 w-5 text-blue-600" />
                  <audio controls src={URL.createObjectURL(audioBlob)} className="flex-1" />
                  <Button
                    type="button"
                    onClick={deleteAudio}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="p-4">
          <Button
            variant="outline"
            onClick={() => {
              setStatusRejectDialog(null);
              setAudioBlob(null);
              setActionComment("");
              setRecordingTime(0);
              if (isRecording) stopRecording();
            }}
            className="rounded-full border-border hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={`rounded-full px-6 py-3 transition-all duration-300 ${
              isSubmitDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : isNeedsMinorChange
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-red-600 hover:bg-red-700"
            } text-white shadow-lg hover:shadow-xl`}
          >
            {isSubmitting ? "Submitting..." : isNeedsMinorChange ? "Submit Changes Request" : "Submit Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
