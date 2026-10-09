"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { safeNextPath } from "@/client/redirect";
import { useSession } from "@/client/session";
import { browserSupabase } from "@/client/supabase";
import { Button } from "@/components/Button/Button";
import { TextField } from "@/components/TextField/TextField";
import styles from "./sign-in.module.css";

export function SignInView() {
  return (
    <main className={styles.page}>
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}

function SignInForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in, or just signed in: continue to where the recruiter was going.
  useEffect(() => {
    if (status === "signed-in") router.replace(next);
  }, [status, next, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await browserSupabase().auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(
        signInError.code === "invalid_credentials"
          ? "Email or password is incorrect."
          : "Could not sign in right now. Try again in a moment.",
      );
    }
  }

  return (
    <form className={styles.card} onSubmit={onSubmit} noValidate>
      <div className={styles.titles}>
        <h1 className={styles.title}>Candidate Search</h1>
        <p className={styles.subtitle}>Sign in to search candidates</p>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <TextField
        label="Email"
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label="Password"
        id="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" loading={submitting} loadingLabel="Signing in…" className={styles.submit}>
        Sign in
      </Button>
    </form>
  );
}
