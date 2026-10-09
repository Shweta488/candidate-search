import styles from "./Button.module.css";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: React.Ref<HTMLButtonElement>; // React 19 passes ref as a normal prop
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  // Shown instead of the label while an action runs, for example "Signing in…".
  loadingLabel?: string;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
