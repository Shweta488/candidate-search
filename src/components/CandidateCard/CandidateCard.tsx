import Link from "next/link";
import { seniorityLabel, yearsText } from "@/client/format";
import type { CandidateSummary } from "@/shared/types";
import { Avatar } from "../Avatar/Avatar";
import { OpenToWork } from "../OpenToWork/OpenToWork";
import styles from "./CandidateCard.module.css";

// One search result or list member. Clicking anywhere on the card opens the candidate
// page (the name is the link); skills the search asked for are highlighted; `action` is a
// button such as Add to list or Remove, which stays clickable on top.
export function CandidateCard({
  candidate,
  matchedSkills = [],
  href,
  action,
}: {
  candidate: CandidateSummary;
  matchedSkills?: string[];
  href: string;
  action?: React.ReactNode;
}) {
  const c = candidate;
  return (
    <article className={`${styles.card} ${styles.clickable}`}>
      <Avatar src={c.avatar_url} name={c.full_name} className={styles.avatar} />
      <div className={styles.top}>
        <h3 className={styles.name}>
          <Link href={href}>{c.full_name}</Link>
        </h3>
        {c.open_to_work && <OpenToWork />}
      </div>
      <p className={styles.line}>
        {c.current_title} · {c.current_company}
      </p>
      <p className={`${styles.line} ${styles.numbers}`}>
        {c.city}, {c.state} · {seniorityLabel(c.seniority)} · {yearsText(c.years_experience)}
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
      {action && <div className={styles.action}>{action}</div>}
    </article>
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
