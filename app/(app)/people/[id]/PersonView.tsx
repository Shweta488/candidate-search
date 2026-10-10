"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { seniorityLabel, yearRange, yearsText } from "@/client/format";
import { safeNextPath } from "@/client/redirect";
import { useApiQuery } from "@/client/useApiQuery";
import { AddToList } from "@/components/AddToList/AddToList";
import { Avatar } from "@/components/Avatar/Avatar";
import { Button } from "@/components/Button/Button";
import { CandidateCardSkeleton } from "@/components/CandidateCard/CandidateCard";
import { OpenToWork } from "@/components/OpenToWork/OpenToWork";
import { PageHeading } from "@/components/PageHeading/PageHeading";
import { StatePanel } from "@/components/StatePanel/StatePanel";
import type { Candidate, ShortlistSummary } from "@/shared/types";
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

function backLabel(back: string): string {
  if (back.startsWith("/search?")) return "Back to results";
  if (back.startsWith("/shortlists/")) return "Back to list";
  return "Back to search";
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
        ‹ {backLabel(back)}
      </Link>
      {data ? (
        <Profile candidate={data} onListsChanged={reload} />
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

function Profile({ candidate: c, onListsChanged }: { candidate: Candidate; onListsChanged: () => void }) {
  return (
    <>
      <div className={styles.head}>
        <Avatar src={c.avatar_url} name={c.full_name} size="lg" className={styles.avatar} />
        <div className={styles.titleRow}>
          <PageHeading>{c.full_name}</PageHeading>
          <AddToList
            candidateId={c.id}
            candidateName={c.full_name}
            listIds={c.shortlist_ids}
            onAdded={onListsChanged}
          />
        </div>
        <p className={styles.line}>
          {c.current_title} · {c.current_company}
        </p>
        <p className={`${styles.line} ${styles.numbers}`}>
          {c.city}, {c.state} · {seniorityLabel(c.seniority)} · {yearsText(c.years_experience)}{" "}
          {c.open_to_work && <OpenToWork />}
        </p>
        <OnYourLists ids={c.shortlist_ids} />
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

// The recruiter's lists this candidate is on, as links. Nothing when they're on none.
function OnYourLists({ ids }: { ids: string[] }) {
  // The API ignores `for`; it changes the path when the candidate's lists change (for
  // example a list just created from Add to list), so the names are read again.
  const path = `/api/shortlists?for=${encodeURIComponent(ids.join(","))}`;
  const { data } = useApiQuery<{ shortlists: ShortlistSummary[] }>(ids.length > 0 ? path : null);
  const lists = (data?.shortlists ?? []).filter((list) => ids.includes(list.id));
  if (ids.length === 0 || lists.length === 0) return null;
  return (
    <p className={styles.onLists}>
      On your lists:{" "}
      {lists.map((list, index) => (
        <span key={list.id}>
          {index > 0 && ", "}
          <Link href={`/shortlists/${list.id}`}>{list.name}</Link>
        </span>
      ))}
    </p>
  );
}
