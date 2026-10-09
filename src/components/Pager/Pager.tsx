import Link from "next/link";
import styles from "./Pager.module.css";

// Previous / Next links. Each page has its own URL, so refresh and back keep the place.
export function Pager({ searchId, page, totalPages }: { searchId: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (n: number) => `/search?id=${encodeURIComponent(searchId)}&page=${n}`;
  return (
    <nav className={styles.pager} aria-label="Pages">
      {page > 1 ? (
        <Link className={styles.link} href={href(page - 1)}>
          ‹ Previous
        </Link>
      ) : (
        <span className={`${styles.link} ${styles.disabled}`} aria-disabled="true">
          ‹ Previous
        </span>
      )}
      <span className={styles.position}>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link className={styles.link} href={href(page + 1)}>
          Next ›
        </Link>
      ) : (
        <span className={`${styles.link} ${styles.disabled}`} aria-disabled="true">
          Next ›
        </span>
      )}
    </nav>
  );
}
