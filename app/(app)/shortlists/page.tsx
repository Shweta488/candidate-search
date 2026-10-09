import type { Metadata } from "next";
import { ShortlistsView } from "./ShortlistsView";

export const metadata: Metadata = { title: "Shortlists" };

export default function ShortlistsPage() {
  return <ShortlistsView />;
}
