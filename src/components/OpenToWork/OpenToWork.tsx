import styles from "./OpenToWork.module.css";

// A dot as well as the colour, so the status isn't shown by colour alone.
export function OpenToWork() {
  return <span className={styles.badge}>Open to work</span>;
}
