"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SmtpConfigForm from "@/components/SmtpConfigForm";
import { AlertCircle, CheckCircle, Mail, Trash2, RefreshCw, Plus, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog";
import toast from "react-hot-toast";

interface SmtpConfig {
  id: number;
  userId: number;
  host: string;
  port: number;
  username: string;
  encryption: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SmtpSettingsPage() {
  const [smtpConfigs, setSmtpConfigs] = useState<SmtpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SmtpConfig | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  const fetchSmtpConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/smtp-config", {
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch SMTP configurations");
      }
      const data = await response.json();
      setSmtpConfigs(data.configs || []);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSmtpConfigs();
    fetch("/api/users")
      .then((res) => res.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const [configToDelete, setConfigToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingConfig, setIsDeletingConfig] = useState(false);

  const confirmDeleteSmtp = async () => {
    if (!configToDelete) return;
    setIsDeletingConfig(true);
    try {
      const response = await fetch(`/api/smtp-config?id=${configToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const errorData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorData.error || "Failed to delete SMTP configuration");
      }

      toast.success("SMTP configuration deleted");
      setConfigToDelete(null);
      await fetchSmtpConfigs();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete configuration");
    } finally {
      setIsDeletingConfig(false);
    }
  };

  const testConnection = async (config: SmtpConfig) => {
    try {
      setTestingConnection(config.id);
      const response = await fetch("/api/smtp-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, testConnection: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Connection test failed");
      }

      const result = await response.json();
      if (result.success) {
        toast.success("SMTP connection verified successfully!");
      } else {
        toast.error("SMTP connection test failed. Check credentials.");
      }
      await fetchSmtpConfigs();
    } catch (err: any) {
      toast.error(`Connection test failed: ${err.message || "Unknown error"}`);
    } finally {
      setTestingConnection(null);
    }
  };

  const setActiveConfig = async (id: number) => {
    try {
      const config = smtpConfigs.find((c) => c.id === id);
      if (!config) return;

      const response = await fetch("/api/smtp-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: config.userId,
          host: config.host,
          port: config.port,
          username: config.username,
          encryption: config.encryption,
          isActive: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update active configuration");
      }

      toast.success("Active SMTP configuration updated");
      await fetchSmtpConfigs();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-44 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <PageHeader
        title="SMTP Mail Delivery"
        description="Configure outgoing mail delivery servers, credentials, TLS/SSL encryption, and test deliverability."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href="/dashboard/settings">
              <ArrowLeft className="size-3.5" />
              Settings
            </Link>
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setShowForm(true);
              setEditingConfig(null);
            }}
          >
            <Plus className="size-3.5" />
            Add Configuration
          </Button>
        </div>
      </PageHeader>

      {error && error !== "Forbidden: Admin access required" && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SMTP Configurations List */}
      <div className="space-y-3">
        {smtpConfigs.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Mail}
              title="No SMTP configurations found"
              description="Add your agency's SMTP credentials to start dispatching task and quotation emails."
              action={{
                label: "Add SMTP Server",
                onClick: () => {
                  setShowForm(true);
                  setEditingConfig(null);
                },
              }}
            />
          </div>
        ) : (
          smtpConfigs.map((config) => (
            <Card
              key={config.id}
              className={`shadow-2xs transition-all border ${
                config.isActive
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/70 bg-card hover:bg-muted/20"
              }`}
            >
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground font-mono">
                      {config.host}:{config.port}
                    </h3>
                    {config.isActive && (
                      <Badge variant="success" className="text-[10px]">
                        Active Default
                      </Badge>
                    )}
                    {config.isVerified ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 gap-1">
                        <CheckCircle className="size-3 text-emerald-600" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 gap-1">
                        <AlertCircle className="size-3 text-amber-600" />
                        Unverified
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="text-foreground font-medium">Username:</span>{" "}
                      <span className="font-mono">{config.username}</span>
                    </div>
                    <div>
                      <span className="text-foreground font-medium">Security:</span>{" "}
                      <span className="uppercase">{config.encryption}</span>
                    </div>
                    <div className="tabular-nums">
                      <span className="text-foreground font-medium">Updated:</span>{" "}
                      {new Date(config.updatedAt).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!config.isActive && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setActiveConfig(config.id)}
                      className="text-xs h-7"
                    >
                      Set Active
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => testConnection(config)}
                    disabled={testingConnection === config.id}
                    title="Test SMTP connection"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw
                      className={`size-3.5 ${
                        testingConnection === config.id ? "animate-spin" : ""
                      }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setEditingConfig(config);
                      setShowForm(true);
                    }}
                    className="text-xs h-7"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      setConfigToDelete({
                        id: config.id,
                        name: `${config.host}:${config.port} (${config.username})`,
                      })
                    }
                    title="Delete configuration"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* SMTP Configuration Form Modal */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingConfig(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Edit SMTP Configuration" : "Add SMTP Configuration"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide host, port, authentication, and encryption settings for mail delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <SmtpConfigForm
              users={users}
              initialData={editingConfig as any}
              onSuccess={() => {
                setShowForm(false);
                setEditingConfig(null);
                fetchSmtpConfigs();
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingConfig(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <DeleteConfirmationDialog
        isOpen={!!configToDelete}
        onClose={() => setConfigToDelete(null)}
        onConfirm={confirmDeleteSmtp}
        itemName={configToDelete?.name || "SMTP Config"}
        entityType="smtp"
        isLoading={isDeletingConfig}
      />
    </div>
  );
}