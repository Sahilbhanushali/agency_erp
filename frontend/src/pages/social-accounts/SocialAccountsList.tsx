import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError, type Paginated } from "@/lib/api";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/types/campaign";
import {
  CONNECTION_COPY,
  type SocialAccount,
} from "@/types/social-account";
import { Link2, Plug, Plus, Trash2, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import SocialAccountFormDialog from "./components/SocialAccountFormDialog";

export default function SocialAccountsList() {
  const { user: actor } = useAuth();
  const isSuperAdmin = actor?.roleName === "SUPER_ADMIN";

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [publishablePlatforms, setPublishablePlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SocialAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canCreate = isSuperAdmin || can(actor, "social_accounts:create");
  const canUpdate = isSuperAdmin || can(actor, "social_accounts:update");
  const canDelete = isSuperAdmin || can(actor, "social_accounts:delete");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [page, platforms] = await Promise.all([
        api.get<Paginated<SocialAccount>>("/social-accounts?limit=200"),
        api.get<{ publishablePlatforms: string[] }>(
          "/social-accounts/platforms"
        ),
      ]);
      setAccounts(page.data);
      setPublishablePlatforms(platforms.publishablePlatforms);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load accounts."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async (account: SocialAccount) => {
    try {
      await api.delete(`/social-accounts/${account.id}/credentials`);
      toast.success(`${account.accountName} disconnected.`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not disconnect."
      );
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/social-accounts/${toDelete.id}`);
      toast.success("Profile removed.");
      setToDelete(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not remove profile."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Accounts"
        description="Client profiles this agency manages, and whether they can be published to."
        breadcrumbs={[{ label: "Social Accounts" }]}
        actions={
          canCreate && (
            <Button
              size="sm"
              className="gap-1.5 h-9 rounded-lg shadow-xs"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>Register Profile</span>
            </Button>
          )
        }
      />

      {publishablePlatforms.length === 0 && !isLoading && (
        <Card className="p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex gap-3">
            <Unplug className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">
                No publishing integrations are configured
              </p>
              <p className="text-muted-foreground">
                This deployment has no platform API credentials, so content
                cannot be pushed automatically. You can still plan and approve
                content here, publish it on the platform yourself, and record it
                against the post — every publish keeps its own audit record
                either way.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="p-4 space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-6 w-24" />
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No profiles registered"
          description="Register the Instagram, Facebook or LinkedIn profiles you manage for each client, so content can be planned and published against them."
          action={
            canCreate
              ? { label: "Register Profile", onClick: () => setFormOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const copy = CONNECTION_COPY[account.connectionState];
            return (
              <Card key={account.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {account.accountName}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {humanizeEnum(account.platform)} · {account.externalId}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
                      copy.tone
                    )}
                  >
                    {copy.label}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {account.client?.name ?? "—"}
                </p>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Plug className="w-3 h-3" />
                  {account.publishingAvailable
                    ? "Automatic publishing available"
                    : "Manual publishing only"}
                </div>

                {account.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {account.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border/60"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-auto pt-1">
                  {canUpdate && account.connectionState !== "NOT_CONNECTED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => void disconnect(account)}
                    >
                      Disconnect
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive ms-auto"
                      onClick={() => setToDelete(account)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <SocialAccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remove Profile"
        description={`Remove ${toDelete?.accountName}? Stored credentials are wiped. Content already published to it keeps its record.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
