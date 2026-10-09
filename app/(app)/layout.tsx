"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlanProvider } from "@/client/plan";
import { useSession } from "@/client/session";
import { AppHeader } from "@/components/AppHeader/AppHeader";
import styles from "./app-layout.module.css";

// Every signed-in page (LLD 6.1, 6.2). The guard is a convenience: the API checks the token on
// every request, and RLS checks it again in the database.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signed-out") {
      const here = `${pathname}${window.location.search}`;
      router.replace(`/sign-in?next=${encodeURIComponent(here)}`);
    }
  }, [status, pathname, router]);

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
