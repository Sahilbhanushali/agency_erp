"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthShell } from "@/components/auth/auth-shell";

interface InvitedUserInfo {
  name: string;
  email: string;
  role: string;
}

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [invitedUser, setInvitedUser] = useState<InvitedUserInfo | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError("Missing onboarding token. Please use the exact link sent to your email.");
      return;
    }

    const verifyToken = async () => {
      try {
        setVerifying(true);
        const res = await fetch(`/api/auth/verify-setup-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setTokenValid(true);
          setInvitedUser(data.user);
        } else {
          setTokenValid(false);
          setTokenError(data.error || "This invitation link has expired or has already been used.");
        }
      } catch {
        setTokenValid(false);
        setTokenError("Failed to verify invitation link. Please check your connection.");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = hasMinLength && passwordsMatch && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      if (!hasMinLength) toast.error("Password must be at least 8 characters long");
      else if (!passwordsMatch) toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Could not set up password");
        setIsSubmitting(false);
        return;
      }

      setSubmitSuccess(true);
      toast.success("Account activated successfully! Signing you in...");

      // Automatically authenticate the user with their newly established credentials
      const signInResult = await signIn("credentials", {
        redirect: false,
        email: invitedUser?.email || data.email,
        password,
      });

      if (signInResult?.ok) {
        toast.success(`Welcome to the team, ${invitedUser?.name || data.name}!`);
        router.push("/dashboard");
      } else {
        // Fallback: route to sign-in page if session creation requires manual login
        toast.success("Password configured! Please sign in with your credentials.");
        router.push("/auth/signin?onboarded=true");
      }
    } catch {
      toast.error("Network error while setting up password");
      setIsSubmitting(false);
    }
  };

  // 1. Verifying token state
  if (verifying) {
    return (
      <Card className="w-full border-border/80 shadow-none">
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 2. Invalid or expired token
  if (!tokenValid) {
    return (
      <Card className="w-full border-border/80 shadow-none">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="size-6" />
          </div>
          <CardTitle className="text-lg font-bold">Invalid or Expired Invitation</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {tokenError}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground text-center">
            Onboarding invite links are active for 48 hours. Please ask your agency manager or administrator to resend your invite from the team directory.
          </p>
          <div className="pt-2">
            <Button asChild className="w-full" variant="outline">
              <Link href="/auth/signin">Return to Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 3. Success state
  if (submitSuccess) {
    return (
      <Card className="w-full border-border/80 shadow-none text-center">
        <CardHeader className="pb-3">
          <div className="mx-auto size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2">
            <ShieldCheck className="size-6" />
          </div>
          <CardTitle className="text-lg font-bold">Account Activated</CardTitle>
          <CardDescription className="text-xs">
            Your password has been configured and your agency access permissions are ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Redirecting to your dashboard...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 4. Active Setup Password Form
  return (
    <Card className="w-full border-border/80 shadow-none">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="font-medium text-[11px] gap-1 px-2.5 py-0.5">
            <Sparkles className="size-3 text-primary" />
            Welcome Onboard
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {invitedUser?.role || "Team Member"}
          </Badge>
        </div>
        <CardTitle className="text-xl font-bold mt-2">
          Welcome, {invitedUser?.name}!
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Create a secure password to activate your account and access your assigned agency modules.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Your Login Email</Label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border text-xs font-mono text-foreground">
              <Mail className="size-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{invitedUser?.email}</span>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">
              Create Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="pr-10 text-xs h-9"
                required
                autoFocus
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-medium">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="text-xs h-9"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Password Validation Checklist */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] space-y-1">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
              <Check className={`size-3 ${hasMinLength ? "opacity-100" : "opacity-30"}`} />
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasLetter && hasNumber ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
              <Check className={`size-3 ${hasLetter && hasNumber ? "opacity-100" : "opacity-30"}`} />
              <span>Contains both letters and numbers</span>
            </div>
            <div className={`flex items-center gap-1.5 ${passwordsMatch ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
              <Check className={`size-3 ${passwordsMatch ? "opacity-100" : "opacity-30"}`} />
              <span>Passwords match</span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2 h-9 text-xs font-semibold"
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Setting up account...
              </>
            ) : (
              <>
                <Lock className="size-3.5" />
                Activate Account & Log In
                <ArrowRight className="size-3.5 ml-auto" />
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Already have an active password?{" "}
            <Link href="/auth/signin" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SetupPasswordPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <Card className="w-full border-border/80 shadow-none">
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        }
      >
        <SetupPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
