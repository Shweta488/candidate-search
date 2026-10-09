"use client";

import { usePlan } from "@/client/plan";
import styles from "./PlanPill.module.css";

// Shows the plan and searches left. Display only until the Upgrade dialog arrives (S7).
export function PlanPill() {
  const { plan } = usePlan();
  if (!plan) return <span className={`${styles.pill} ${styles.loading}`} aria-hidden="true" />;

  if (plan.plan === "paid") {
    return <span className={`${styles.pill} ${styles.paid}`}>Paid plan</span>;
  }

  const left = plan.searches_remaining ?? 0;
  const searches = left === 1 ? "search" : "searches";
  return (
    <span className={`${styles.pill} ${left === 0 ? styles.empty : styles.free}`}>
      Free · <span className={styles.long}>{`${left} ${searches} left`}</span>
      <span className={styles.short} aria-hidden="true">{`${left} left`}</span>
    </span>
  );
}
