"use client";

import { PageHeading } from "@/components/PageHeading/PageHeading";
import styles from "./search.module.css";

// Placeholder until S2 adds the brief box and results.
export function SearchView() {
  return (
    <>
      <PageHeading>Find candidates</PageHeading>
      <p className={styles.note}>Search arrives in the next story. You are signed in and your plan is shown above.</p>
    </>
  );
}
