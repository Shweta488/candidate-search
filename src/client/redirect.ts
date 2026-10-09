// Where to go after sign-in. Only a path on this site is followed, so a crafted
// ?next= link can't send a recruiter to another website (LLD 6.2).
export function safeNextPath(next: string | null, fallback = "/search"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
