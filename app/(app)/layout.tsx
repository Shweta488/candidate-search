"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlanProvider } from "@/client/plan";
import { useSession } from "@/client/session";
import { AppHeader } from "@/components/AppHeader/AppHeader";
import styles from "./app-layout.module.css";

// Every signed-in page (LLD 6.1, 6.2). The guard is a convenience: the API checks the token on
// every request, and RLS checks it again in the database.
//
// A signed-out visitor goes to sign-in and comes back to the page they asked for, so a
// shared link works. After pressing Sign out there is nowhere to come back to: the next
// sign-in (perhaps as another company) starts on Search.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status, signedOutOnPurpose } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "signed-out") return;
    if (signedOutOnPurpose) return router.replace("/sign-in");
    const here = `${pathname}${window.location.search}`;
    router.replace(`/sign-in?next=${encodeURIComponent(here)}`);
  }, [status, signedOutOnPurpose, pathname, router]);

  if (status !== "signed-in") return <div className={styles.waiting} aria-busy="true" />;

  return (
    <PlanProvider>
      <AppHeader />
      <main id="content" className={styles.main}>
        {children}
      </main>
    </PlanProvider>
  );
}
