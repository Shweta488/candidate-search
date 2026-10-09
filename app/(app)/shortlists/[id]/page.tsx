import type { Metadata } from "next";
import { ShortlistView } from "./ShortlistView";

// The tab shows the list's name once loaded (ShortlistView); this is the title until then.
export const metadata: Metadata = { title: "Shortlist" };

export default function ShortlistPage() {
  return <ShortlistView />;
}
