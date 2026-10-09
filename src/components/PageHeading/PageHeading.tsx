"use client";

import { useEffect, useRef } from "react";
import styles from "./PageHeading.module.css";

// The page's one h1. It takes focus when the page opens, so keyboard and screen reader
// users know the page changed without a full reload (LLD 6.7).
export function PageHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={styles.heading}>
      {children}
    </h1>
  );
}
