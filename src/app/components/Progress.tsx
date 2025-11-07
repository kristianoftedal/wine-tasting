import type React from 'react';
import styles from './Progress.module.css';

interface ProgressProps {
  message?: string;
  variant?: 'spinner' | 'dots' | 'bar';
  size?: 'small' | 'medium' | 'large';
}

export const Progress: React.FC<ProgressProps> = ({ message, variant = 'bar', size = 'large' }) => {
  return (
    <div className={`${styles.progressContainer} ${styles[size]}`}>
      {variant === 'spinner' && (
        <div className={styles.spinnerWrapper}>
          <svg
            className={styles.spinner}
            viewBox="0 0 50 50">
            <circle
              className={styles.path}
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="4"
            />
          </svg>
        </div>
      )}

      {variant === 'dots' && (
        <div className={styles.dots}>
          <div className={styles.dot} />
          <div className={styles.dot} />
          <div className={styles.dot} />
        </div>
      )}

      {variant === 'bar' && (
        <div className={styles.barWrapper}>
          <div className={styles.bar} />
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
};
