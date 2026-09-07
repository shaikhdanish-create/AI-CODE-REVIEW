import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(100),
    email: z.string().trim().email("Enter a valid email address.").max(255),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters.")
      .max(128, "Password must be less than 128 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const signupSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: (search) => signupSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Create account — PyReview" },
      {
        name: "description",
        content: "Create a free PyReview account to save your Python code reviews privately.",
      },
      { property: "og:title", content: "Create account — PyReview" },
      {
        property: "og:description",
        content: "Sign up for PyReview and keep your Python code review history private.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, user, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = signupSchema.safeParse({ name, email, password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.errors.map((e) => e.message).join(" "));
      return;
    }

    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { full_name: parsed.data.name },
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        navigate({ to: "/", replace: true });
        return;
      }
      setCreated(true);
    } catch (err) {
      const message = (err as Error).message || "Could not create account.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it
          to activate your account, then sign in.
        </p>
        <div className="mt-6">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">account</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Save your reviews privately and track code quality over time.
      </p>

      <Card className="mt-6 p-6">
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
