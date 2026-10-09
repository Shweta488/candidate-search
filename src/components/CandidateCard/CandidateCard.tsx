"use client";

import { useState } from "react";
import type { CandidateSummary } from "@/shared/types";
import styles from "./CandidateCard.module.css";

// One search result. Skills the search asked for are highlighted.
// The candidate page arrives in S4; until then the name is plain text.

const SENIORITY: Record<string, string> = { junior: "Junior", mid: "Mid-level", senior: "Senior", staff: "Staff" };

export function CandidateCard({ candidate, matchedSkills }: { candidate: CandidateSummary; matchedSkills: string[] }) {
  const c = candidate;
  return (
    <article className={styles.card}>
      <Avatar src={c.avatar_url} name={c.full_name} />
      <div className={styles.top}>
        <h3 className={styles.name}>{c.full_name}</h3>
        {c.open_to_work && <span className={styles.openToWork}>Open to work</span>}
      </div>
      <p className={styles.line}>
        {c.current_title} · {c.current_company}
      </p>
      <p className={`${styles.line} ${styles.numbers}`}>
        {c.city}, {c.state} · {SENIORITY[c.seniority] ?? c.seniority} · {c.years_experience}{" "}
        {c.years_experience === 1 ? "year" : "years"}
      </p>
      <ul className={styles.skills} aria-label="Skills">
        {c.skills.map((skill) => {
          const matched = matchedSkills.includes(skill);
          return (
            <li key={skill} className={matched ? `${styles.skill} ${styles.matched}` : styles.skill}>
              {skill}
              {matched && <span className="visually-hidden"> (matches your search)</span>}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

// The photo, or the candidate's initials if it can't be loaded. Decorative: the name is next to it.
function Avatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  if (failed) {
    return (
      <span className={styles.avatar} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    // A plain img: the photos are small SVGs from the assessment data, so Next's image
    // optimisation adds nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.avatar} src={src} alt="" width={48} height={48} onError={() => setFailed(true)} />
  );
}

export function CandidateCardSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <i className={styles.skeletonCircle} />
      <div className={styles.skeletonLines}>
        <i style={{ width: "40%" }} />
        <i style={{ width: "70%" }} />
        <i style={{ width: "55%" }} />
      </div>
    </div>
  );
}
