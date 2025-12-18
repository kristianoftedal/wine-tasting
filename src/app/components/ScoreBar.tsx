import styles from './ScoreBar.module.css';

interface ScoreBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

export default function ScoreBar({ label, value, max, color = '#8b5cf6' }: ScoreBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={styles.scoreBar}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div className={styles.barContainer}>
        <div
          className={styles.barFill}
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
}
