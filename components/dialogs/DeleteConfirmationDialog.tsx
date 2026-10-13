"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export type DeleteEntityType =
  | "user"
  | "client"
  | "project"
  | "post"
  | "lead"
  | "credential"
  | "expense"
  | "contract"
  | "utility"
  | "smtp"
  | "task"
  | "invoice"
  | "quotation"
  | "asset"
  | (string & {});

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  itemName: string;
  entityType?: DeleteEntityType;
  title?: string;
  isLoading?: boolean;
  extraInfo?: {
    postCount?: number;
    projectCount?: number;
  };
}

export default function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  entityType = "item",
  title,
  isLoading = false,
  extraInfo,
}: DeleteConfirmationDialogProps) {
  const getEntityConfig = () => {
    switch (entityType) {
      case "user":
        return {
          title: title || `Delete User: "${itemName}"?`,
          subtitle: "Please review what will happen when this user is deleted:",
          willDelete: [
            "User profile and login access will be permanently removed",
            "Personal notifications and saved SMTP settings will be deleted",
          ],
          willKeep: [
            "All posts created by or assigned to this user will NOT be deleted (preserved)",
            "All comments, audit trails, and task logs will be safely retained",
            "Projects managed by this user will remain active",
          ],
          dangerLevel: "medium" as const,
        };

      case "client":
        return {
          title: title || `Delete Client: "${itemName}"?`,
          subtitle: "Please review what will happen when this client is deleted:",
          willDelete: [
            "Client contact details and company profile will be removed",
          ],
          willKeep: [
            "All projects under this client will NOT be deleted (client will show as 'No Client')",
            "All posts, assets, and project data will remain completely intact",
          ],
          dangerLevel: "medium" as const,
        };

      case "project":
        return {
          title: title || `Delete Project: "${itemName}"?`,
          subtitle: "⚠️ CAUTION: Deleting a project will permanently delete all its contents:",
          willDelete: [
            "The project and its configurations will be permanently deleted",
            `ALL posts associated with this project will be PERMANENTLY deleted`,
            "All uploaded media assets, images, and videos in those posts will be deleted",
            "All post comments, approval flows, and task logs will be deleted",
            "Project monthly strategies and activity records will be deleted",
          ],
          willKeep: [
            "The client and assigned team members will remain intact",
          ],
          dangerLevel: "high" as const,
        };

      case "post":
        return {
          title: title || `Delete Post: "${itemName}"?`,
          subtitle: "Please review what will happen when this post is deleted:",
          willDelete: [
            "This post and its caption, schedule, and metadata will be deleted",
            "All media assets attached to this post will be deleted",
            "All comments and approval histories on this post will be removed",
          ],
          willKeep: [
            "The parent project and client will NOT be affected",
          ],
          dangerLevel: "medium" as const,
        };

      case "lead":
        return {
          title: title || `Delete Lead: "${itemName}"?`,
          subtitle: "Please review what will happen when this sales lead is deleted:",
          willDelete: [
            "This sales inquiry, deal valuation, and contact details will be removed",
            "All logged activities and call notes for this lead will be deleted",
          ],
          willKeep: [
            "Existing client accounts and ongoing projects will NOT be affected",
          ],
          dangerLevel: "medium" as const,
        };

      case "credential":
        return {
          title: title || (itemName ? `Delete Credential: "${itemName}"?` : "Delete Credential?"),
          subtitle: "Please review what will happen when this credential is deleted:",
          willDelete: [
            "The stored platform login, username, and encrypted password will be permanently deleted",
          ],
          willKeep: [
            "The associated client and project accounts will NOT be affected",
          ],
          dangerLevel: "low" as const,
        };

      case "expense":
        return {
          title: title || `Delete Expense: "${itemName}"?`,
          subtitle: "Please review what will happen when this expense record is deleted:",
          willDelete: [
            "This expense transaction will be permanently removed from cash flow records",
            "Attached receipts or expense documents will be unlinked",
          ],
          willKeep: [
            "Associated project budgets and client totals will be updated",
          ],
          dangerLevel: "medium" as const,
        };

      case "contract":
        return {
          title: title || `Delete Contract Agreement: "${itemName}"?`,
          subtitle: "Please review what will happen when this contract is removed:",
          willDelete: [
            "This agreement and recorded SOW deliverable terms will be deleted",
          ],
          willKeep: [
            "Client profile and invoices already created will remain intact",
          ],
          dangerLevel: "high" as const,
        };

      case "smtp":
        return {
          title: title || `Delete SMTP Config: "${itemName}"?`,
          subtitle: "Please review what will happen when this mail server is removed:",
          willDelete: [
            "This SMTP host, port, credentials, and encryption settings will be removed",
          ],
          willKeep: [
            "Previously sent emails and audit logs will remain intact",
          ],
          dangerLevel: "medium" as const,
        };

      case "utility":
        return {
          title: title || `Delete Utility: "${itemName}"?`,
          subtitle: "Please review what will happen when this configuration utility is deleted:",
          willDelete: [
            "This dropdown / lookup utility option will be removed from system presets",
          ],
          willKeep: [
            "Existing records using this value will preserve their current selection",
          ],
          dangerLevel: "medium" as const,
        };

      case "asset":
        return {
          title: title || `Delete Asset: "${itemName}"?`,
          subtitle: "Please review what will happen when this asset is deleted:",
          willDelete: [
            "This uploaded media file will be permanently removed from storage",
          ],
          willKeep: [
            "Associated projects and post activity logs will remain intact",
          ],
          dangerLevel: "medium" as const,
        };

      default:
        return {
          title: title || (itemName ? `Delete "${itemName}"?` : "Confirm Deletion?"),
          subtitle: `Are you sure you want to permanently delete this ${entityType}?`,
          willDelete: [
            `This ${entityType} record will be permanently deleted and cannot be undone`,
          ],
          willKeep: [
            "All other system modules and audit histories will remain unaffected",
          ],
          dangerLevel: "medium" as const,
        };
    }
  };

  const config = getEntityConfig();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <AlertDialogContent className="max-w-md p-6 bg-card text-card-foreground border border-border shadow-xl rounded-xl">
        <AlertDialogHeader className="space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-full flex-shrink-0 ${
                config.dangerLevel === "high"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 ring-4 ring-red-500/10"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10"
              }`}
            >
              {config.dangerLevel === "high" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-bold text-foreground leading-tight">
                {config.title}
              </AlertDialogTitle>
            </div>
          </div>

          <AlertDialogDescription className="text-xs text-muted-foreground font-medium pt-1">
            {config.subtitle}
          </AlertDialogDescription>

          <div className="space-y-3 pt-1 text-xs">
            {/* What will be deleted */}
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 space-y-1.5">
              <span className="font-semibold text-red-600 dark:text-red-400 text-[11px] uppercase tracking-wider block mb-1">
                Will be deleted:
              </span>
              {config.willDelete.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-red-700 dark:text-red-300">
                  <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                  <span className="leading-tight">{item}</span>
                </div>
              ))}
            </div>

            {/* What will NOT be deleted / preserved */}
            {config.willKeep.length > 0 && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1.5">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider block mb-1">
                  Will NOT be deleted (Safe):
                </span>
                {config.willKeep.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />
                    <span className="leading-tight">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-5 sm:space-x-2">
          <AlertDialogCancel
            disabled={isLoading}
            onClick={onClose}
            className="border-border text-foreground hover:bg-muted"
          >
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isLoading}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Yes, Delete"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
