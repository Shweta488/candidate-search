import type { Metadata } from "next";
import { PersonView } from "./PersonView";

// The tab shows the candidate's name once loaded (PersonView); this is the title until then.
export const metadata: Metadata = { title: "Candidate" };

export default function PersonPage() {
  return <PersonView />;
}
