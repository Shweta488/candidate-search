"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/client/session";
import { Button } from "@/components/Button/Button";
import { PlanPill } from "@/components/PlanPill/PlanPill";
import styles from "./AppHeader.module.css";

// Links are added as their stories land (Shortlists in S5, Saved searches in S6).
const NAV = [{ href: "/search", label: "Search" }];

export function AppHeader() {
  const pathname = usePathname();
  const { signOut } = useSession();
  return (
    <header className={styles.header}>
      <a href="#content" className={styles.skip}>
        Skip to content
      </a>
      <div className={styles.inner}>
        <Link href="/search" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            R
          </span>
          Candidate Search
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.link}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.end}>
          <PlanPill />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
