"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePlan } from "@/client/plan";
import { Button } from "@/components/Button/Button";
import styles from "./UpgradeDialog.module.css";

// Explains how plans change. There is no checkout in this app: the plan follows the
// company's Stripe subscription (LLD 5), so the dialog explains instead of selling.
//
// Native <dialog> with showModal: the page behind can't be reached, and Escape closes it.
// Focus goes back to whatever opened it.
export function UpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const { reload } = usePlan();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      opener.current = document.activeElement as HTMLElement | null;
      element.showModal();
      heading.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  // Runs for Close, Escape and a click outside alike.
  function handleClose() {
    onClose();
    reload(); // pick up a plan that changed while the dialog was open
    opener.current?.focus();
  }

  // Escape is handled here rather than left to the browser, so the dialog closes the same
  // way everywhere, and it doesn't also close an inline panel this dialog was opened from.
  function closeOnEscape(event: React.KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={handleClose}
      onKeyDown={closeOnEscape}
      // A click on the backdrop lands on the <dialog> itself, not on its content.
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
    >
      <div className={styles.content}>
        <h2 ref={heading} id={titleId} className={styles.title} tabIndex={-1}>
          Upgrade to the paid plan
        </h2>
        <p className={styles.text}>The free plan includes 1 search. The paid plan has unlimited searches.</p>
        <p className={styles.text}>
          Upgrades are handled through your company&apos;s billing account, not here. As soon as your subscription
          starts, you&apos;ll get unlimited searches. If it ends, you&apos;ll go back to the free plan.
        </p>
        <p className={styles.text}>Your shortlists and saved searches stay with you on either plan.</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            Close
          </Button>
        </div>
      </div>
    </dialog>
  );
}

// An Upgrade button that opens the dialog, for the places that tell the recruiter
// they've used their free search.
export function UpgradeButton({ size = "md" }: { size?: "md" | "sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Upgrade
      </Button>
      <UpgradeDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
