"use client";

import { useId } from "react";
import styles from "./TextField.module.css";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  ref?: React.Ref<HTMLInputElement>; // React 19 passes ref as a normal prop
};

export function TextField({ label, error, id, className, ...rest }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
