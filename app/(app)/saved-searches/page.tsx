import type { Metadata } from "next";
import { SavedSearchesView } from "./SavedSearchesView";

export const metadata: Metadata = { title: "Saved searches" };

export default function SavedSearchesPage() {
  return <SavedSearchesView />;
}
