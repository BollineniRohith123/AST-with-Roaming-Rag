'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  details?: string;
  variant?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
  autoHide?: boolean | number;
  onDismiss?: () => void;
}

/**
 * ErrorAlert component for displaying error messages
 */
export function ErrorAlert({
  title,
  message,
  details,
  variant = 'error',
  dismissible = true,
  autoHide = false,
  onDismiss,
}: ErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Set up auto-hide timer if enabled
  useEffect(() => {
    if (autoHide) {
      const timeout = typeof autoHide === 'number' ? autoHide : 5000;
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onDismiss) onDismiss();
      }, timeout);
      
      return () => clearTimeout(timer);
    }
  }, [autoHide, onDismiss]);

  // Handle dismiss click
  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  // If not visible, don't render
  if (!isVisible) return null;

  // Determine background and text colors based on variant
  const variantStyles = {
    error: {
      background: 'bg-red-100 dark:bg-red-900/20',
      border: 'border-red-400 dark:border-red-700',
      text: 'text-red-800 dark:text-red-100',
      icon: 'text-red-500 dark:text-red-400',
    },
    warning: {
      background: 'bg-yellow-100 dark:bg-yellow-900/20',
      border: 'border-yellow-400 dark:border-yellow-700',
      text: 'text-yellow-800 dark:text-yellow-100',
      icon: 'text-yellow-500 dark:text-yellow-400',
    },
    info: {
      background: 'bg-blue-100 dark:bg-blue-900/20',
      border: 'border-blue-400 dark:border-blue-700',
      text: 'text-blue-800 dark:text-blue-100',
      icon: 'text-blue-500 dark:text-blue-400',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={`rounded-md ${styles.background} ${styles.border} border p-4 my-4 relative`}
      role="alert"
      data-testid="error-alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className={`h-5 w-5 ${styles.icon}`} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${styles.text}`}>{title}</h3>
          )}
          <div className={`text-sm ${styles.text} mt-1`}>
            <p>{message}</p>
            {details && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">View details</summary>
                <p className="mt-2 text-sm whitespace-pre-wrap">{details}</p>
              </details>
            )}
          </div>
        </div>
        {dismissible && (
          <button
            type="button"
            className={`${styles.text} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-md`}
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorAlert;