"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useSession } from "@/client/session";
import { Button } from "@/components/Button/Button";
import { PlanPill } from "@/components/PlanPill/PlanPill";
import styles from "./AppHeader.module.css";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/shortlists", label: "Shortlists" },
  { href: "/saved-searches", label: "Saved searches" },
];

// On phones the links and Sign out move into a menu; the plan pill stays visible.
export function AppHeader() {
  const pathname = usePathname();
  const { signOut } = useSession();
  const [menu, setMenu] = useState<{ open: boolean; at: string }>({ open: false, at: pathname });
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = menu.open && menu.at === pathname; // closes by itself after navigating

  const links = NAV.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={styles.link}
      aria-current={pathname.startsWith(item.href) ? "page" : undefined}
    >
      {item.label}
    </Link>
  ));

  return (
    <header
      className={styles.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setMenu({ open: false, at: pathname });
          menuButton.current?.focus();
        }
      }}
    >
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
        <nav aria-label="Main" className={`${styles.nav} ${styles.wide}`}>
          {links}
        </nav>
        <div className={styles.end}>
          <PlanPill />
          <Button variant="ghost" size="sm" className={styles.wide} onClick={() => void signOut()}>
            Sign out
          </Button>
          <button
            ref={menuButton}
            type="button"
            className={`${styles.menuButton} ${styles.narrow}`}
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="phone-menu"
            onClick={() => setMenu({ open: !open, at: pathname })}
          >
            <span className={styles.bars} aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && (
        <div id="phone-menu" className={`${styles.menu} ${styles.narrow}`}>
          <nav aria-label="Main" className={styles.menuNav}>
            {links}
          </nav>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      )}
    </header>
  );
}
