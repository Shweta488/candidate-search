"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { seniorityLabel, yearRange, yearsText } from "@/client/format";
import { safeNextPath } from "@/client/redirect";
import { useApiQuery } from "@/client/useApiQuery";
import { Avatar } from "@/components/Avatar/Avatar";
import { Button } from "@/components/Button/Button";
import { CandidateCardSkeleton } from "@/components/CandidateCard/CandidateCard";
import { OpenToWork } from "@/components/OpenToWork/OpenToWork";
import { PageHeading } from "@/components/PageHeading/PageHeading";
import { StatePanel } from "@/components/StatePanel/StatePanel";
import type { Candidate } from "@/shared/types";
import styles from "./person.module.css";

// The candidate page (LLD 1.4, 6.1). Opened from a result card, "Back to results" returns
// to that search and page; opened directly, it goes to the search page.

export function PersonView() {
  return (
    <Suspense>
      <Person />
    </Suspense>
  );
}

function Person() {
  const { id } = useParams<{ id: string }>();
  const back = safeNextPath(useSearchParams().get("back"));
  const { data, error, reload } = useApiQuery<Candidate>(`/api/people/${encodeURIComponent(id)}`);

  // Next sets the tab title from metadata on navigation; once loaded, show the name.
  useEffect(() => {
    if (data) document.title = `${data.full_name} · Candidate Search`;
  }, [data]);

  return (
    <div className={styles.person}>
      <Link href={back} className={styles.back}>
        ‹ {back.startsWith("/search?") ? "Back to results" : "Back to search"}
      </Link>
      {data ? (
        <Profile candidate={data} />
      ) : error?.status === 404 ? (
        <>
          <PageHeading>Candidate</PageHeading>
          <StatePanel
            tone="plain"
            title="We couldn't find this candidate."
            action={<Link href="/search">Search</Link>}
          />
        </>
      ) : error ? (
        <>
          <PageHeading>Candidate</PageHeading>
          <StatePanel
            tone="error"
            title="Something went wrong."
            action={
              <Button variant="secondary" onClick={reload}>
                Try again
              </Button>
            }
          />
        </>
      ) : (
        <div aria-busy="true" aria-label="Loading candidate">
          <CandidateCardSkeleton />
        </div>
      )}
    </div>
  );
}

function Profile({ candidate: c }: { candidate: Candidate }) {
  return (
    <>
      <div className={styles.head}>
        <Avatar src={c.avatar_url} name={c.full_name} size="lg" className={styles.avatar} />
        <PageHeading>{c.full_name}</PageHeading>
        <p className={styles.line}>
          {c.current_title} · {c.current_company}
        </p>
        <p className={`${styles.line} ${styles.numbers}`}>
          {c.city}, {c.state} · {seniorityLabel(c.seniority)} · {yearsText(c.years_experience)}{" "}
          {c.open_to_work && <OpenToWork />}
        </p>
      </div>

      <section className={styles.section} aria-labelledby="skills-heading">
        <h2 id="skills-heading">Skills</h2>
        <ul className={styles.skills}>
          {c.skills.map((skill) => (
            <li key={skill} className={styles.skill}>
              {skill}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="experience-heading">
        <h2 id="experience-heading">Experience</h2>
        <ol className={styles.list}>
          {c.experiences.map((job, index) => (
            <li key={index} className={styles.job}>
              <p>
                <strong>{job.title}</strong> · {job.company}{" "}
                <span className={styles.typeChip}>{job.company_type === "startup" ? "Startup" : "Enterprise"}</span>
              </p>
              <p className={`${styles.muted} ${styles.numbers}`}>{yearRange(job.start_year, job.end_year)}</p>
              <p className={styles.muted}>{job.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="education-heading">
        <h2 id="education-heading">Education</h2>
        <ul className={styles.list}>
          {c.education.map((school, index) => (
            <li key={index}>
              {school.school} · {school.degree}, {school.field} ·{" "}
              <span className={styles.numbers}>{school.graduation_year}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
