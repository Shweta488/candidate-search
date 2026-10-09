import styles from "./StatePanel.module.css";

// A message shown in place of results: no matches, couldn't filter, errors, the limit.
type Props = {
  tone: "plain" | "warning" | "error" | "limit";
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
};

export function StatePanel({ tone, title, children, action }: Props) {
  return (
    <div className={`${styles.panel} ${styles[tone]}`}>
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
