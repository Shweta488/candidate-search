"use client";

import { useState } from "react";
import styles from "./Avatar.module.css";

// The candidate's photo, or their initials if it can't be loaded. Decorative: the name
// is always next to it.
export function Avatar({ src, name, size = "md", className }: {
  src: string;
  name: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const classes = [styles.avatar, styles[size], className].filter(Boolean).join(" ");
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  if (failed) {
    return (
      <span className={classes} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    // A plain img: the photos are small SVGs from the assessment data, so Next's image
    // optimisation adds nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={classes} src={src} alt="" onError={() => setFailed(true)} />
  );
}
