"use client";

import { useState } from "react";
import { usePlan } from "@/client/plan";
import { UpgradeDialog } from "@/components/UpgradeDialog/UpgradeDialog";
import styles from "./PlanPill.module.css";

// Shows the plan and searches left. On the free plan it opens the Upgrade dialog.
export function PlanPill() {
  const { plan } = usePlan();
  const [open, setOpen] = useState(false);
  if (!plan) return <span className={`${styles.pill} ${styles.loading}`} aria-hidden="true" />;

  if (plan.plan === "paid") {
    return <span className={`${styles.pill} ${styles.paid}`}>Paid plan</span>;
  }

  const left = plan.searches_remaining ?? 0;
  const searches = left === 1 ? "search" : "searches";
  return (
    <>
      <button
        type="button"
        className={`${styles.pill} ${styles.button} ${left === 0 ? styles.empty : styles.free}`}
        aria-haspopup="dialog"
        // The visible text is shortened at phone width; the name stays complete.
        aria-label={`Free plan, ${left} ${searches} left. Upgrade`}
        onClick={() => setOpen(true)}
      >
        Free · <span className={styles.long}>{`${left} ${searches} left`}</span>
        <span className={styles.short} aria-hidden="true">{`${left} left`}</span>
        <span className={styles.upgrade} aria-hidden="true">
          · <span className={styles.upgradeWord}>Upgrade</span>
        </span>
      </button>
      <UpgradeDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
