"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import DeleteConfirmationDialog from "@/components/dialogs/DeleteConfirmationDialog"
import { useCan } from "@/hooks/use-can"
import Link from "next/link"
import { AlertTriangle, BarChart3, Instagram, Link2, Loader2, Plug, RefreshCw } from "lucide-react"

interface SocialAccount {
  id: string
  platform: string
  username: string
  accountType: string | null
  profilePictureUrl: string | null
  status: "CONNECTED" | "REAUTH_REQUIRED" | "DISCONNECTED" | "ERROR"
  statusMessage: string | null
  lastSyncedAt: string | null
  tokenExpiresAt: string | null
  daysUntilExpiry: number | null
  needsAttention: boolean
  client: { id: string; name: string } | null
  connectedBy: { id: number; name: string } | null
}

interface ClientOption {
  id: string
  name: string
}

/** Each state says what it means and, where it matters, what to do about it. */
const STATUS: Record<
  SocialAccount["status"],
  { label: string; className: string; hint?: string }
> = {
  CONNECTED: {
    label: "Connected",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  },
  REAUTH_REQUIRED: {
    label: "Reconnect needed",
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    hint: "Instagram will not accept the stored token. Publishing and analytics are paused until this account is reconnected.",
  },
  DISCONNECTED: {
    label: "Disconnected",
    className: "bg-muted text-muted-foreground border-border",
    hint: "The token was destroyed. Past posts keep their history.",
  },
  ERROR: {
    label: "Sync problem",
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
    hint: "The last attempt to reach Instagram failed. This usually clears by itself.",
  },
}

export default function SocialAccountsPage() {
  const { can, ready } = useCan()
  const searchParams = useSearchParams()

  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connectFor, setConnectFor] = useState<string>("agency")
  const [connecting, setConnecting] = useState(false)
  const [toDisconnect, setToDisconnect] = useState<SocialAccount | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/social/accounts")
      if (!response.ok) throw new Error((await response.json()).error ?? "Failed to load accounts")
      setAccounts((await response.json()).accounts ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load accounts")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.clients ?? [])
        setClients(list.map((c: ClientOption) => ({ id: c.id, name: c.name })))
      })
      .catch(() => undefined)
  }, [])

  // The OAuth callback redirects back here with the outcome, so it is reported once
  // on arrival rather than left for the user to infer from the list.
  useEffect(() => {
    const status = searchParams.get("status")
    if (!status) return
    const message = searchParams.get("message")
    if (status === "connected") toast.success(`@${searchParams.get("account")} connected.`)
    else if (status === "cancelled") toast(message ?? "Authorisation was cancelled.")
    else if (status === "error") toast.error(message ?? "Could not connect that account.")
    window.history.replaceState({}, "", "/dashboard/social/accounts")
  }, [searchParams])

  const startConnect = async (reconnectAccountId?: string) => {
    setConnecting(true)
    try {
      const response = await fetch("/api/social/instagram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: connectFor === "agency" ? null : connectFor,
          reconnectAccountId: reconnectAccountId ?? null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not start the connection")
      // Full navigation, not fetch: the browser has to land on instagram.com.
      window.location.href = data.authorizationUrl
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the connection")
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (!toDisconnect) return
    setIsDisconnecting(true)
    try {
      const response = await fetch(`/api/social/accounts/${toDisconnect.id}`, { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not disconnect")
      toast.success(data.message)
      setToDisconnect(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const needingAttention = useMemo(() => accounts.filter((a) => a.needsAttention), [accounts])

  const canConnect = ready && can("social_accounts", "create")
  const canReconnect = ready && can("social_accounts", "update")
  const canDisconnect = ready && can("social_accounts", "delete")

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Social Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Instagram professional accounts this agency is authorised to publish to.
          </p>
          <Button variant="link" size="sm" asChild className="mt-1 h-auto gap-1.5 p-0 text-sm">
            <Link href="/dashboard/social/insights">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              View performance insights
            </Link>
          </Button>
        </div>

        {canConnect && (
          <div className="flex items-center gap-2">
            <Select value={connectFor} onValueChange={setConnectFor}>
              <SelectTrigger className="w-56 h-9" aria-label="Account belongs to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agency">Our own account</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => void startConnect()} disabled={connecting} className="h-9 gap-1.5">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
              Connect Instagram
            </Button>
          </div>
        )}
      </div>

      {needingAttention.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">
                {needingAttention.length} account{needingAttention.length === 1 ? "" : "s"} need attention
              </p>
              <p className="text-muted-foreground mt-0.5">
                Scheduled publishing and analytics are paused for{" "}
                {needingAttention.map((a) => `@${a.username}`).join(", ")}.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-6 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">No accounts connected yet</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Connect an Instagram professional account — your own or a client&apos;s — to
                schedule content and read its performance. The account owner authorises it
                on Instagram; this app never asks for their password.
              </p>
            </div>
            {canConnect && (
              <Button onClick={() => void startConnect()} disabled={connecting} className="mt-1 gap-1.5">
                <Instagram className="h-4 w-4" />
                Connect Instagram
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const status = STATUS[account.status]
            const expiringSoon =
              account.status === "CONNECTED" &&
              account.daysUntilExpiry !== null &&
              account.daysUntilExpiry <= 10

            return (
              <Card key={account.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base">
                      <Instagram className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">@{account.username}</span>
                    </CardTitle>
                    <Badge variant="outline" className={`shrink-0 ${status.className}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {account.client ? account.client.name : "Our own account"}
                    {account.accountType ? ` · ${account.accountType.toLowerCase()}` : ""}
                  </p>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-3 pt-0 text-xs">
                  {(status.hint || account.statusMessage) && (
                    <p className="text-muted-foreground">{account.statusMessage ?? status.hint}</p>
                  )}

                  <dl className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <dt>Last synced</dt>
                      <dd className="text-foreground/80">
                        {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString() : "Never"}
                      </dd>
                    </div>
                    {account.daysUntilExpiry !== null && account.status !== "DISCONNECTED" && (
                      <div className="flex justify-between gap-2">
                        <dt>Authorisation</dt>
                        <dd className={expiringSoon ? "text-amber-600 dark:text-amber-400" : "text-foreground/80"}>
                          {account.daysUntilExpiry > 0
                            ? `renews in ${account.daysUntilExpiry} days`
                            : "expired"}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-auto flex items-center gap-2 pt-1">
                    {canReconnect && account.status !== "CONNECTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        disabled={connecting}
                        onClick={() => void startConnect(account.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reconnect
                      </Button>
                    )}
                    {canDisconnect && account.status !== "DISCONNECTED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-8 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setToDisconnect(account)}
                      >
                        <Plug className="h-3.5 w-3.5" />
                        Disconnect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <DeleteConfirmationDialog
        isOpen={!!toDisconnect}
        onClose={() => setToDisconnect(null)}
        onConfirm={disconnect}
        isLoading={isDisconnecting}
        itemName={toDisconnect ? `@${toDisconnect.username}` : ""}
        title={
          toDisconnect
            ? `Disconnect @${toDisconnect.username}? Its stored token is destroyed and any scheduled posts for this account will stop. Published history is kept.`
            : "Disconnect account"
        }
      />
    </div>
  )
}
