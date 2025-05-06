'use client';

import { Loader2 } from 'lucide-react';

interface LoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

/**
 * Loading spinner component with optional text
 */
export function Loading({
  text,
  size = 'md',
  fullScreen = false,
  className = '',
}: LoadingProps) {
  // Determine spinner size
  const spinnerSize = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  }[size];

  // Determine text size
  const textSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size];

  // If fullScreen, show a centered spinner with backdrop
  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 bg-gray-900/50 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50"
        data-testid="loading-fullscreen"
      >
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col items-center">
          <Loader2 className={`${spinnerSize} text-primary animate-spin`} />
          {text && <p className={`${textSize} mt-4 text-gray-700 dark:text-gray-300`}>{text}</p>}
        </div>
      </div>
    );
  }

  // Regular inline spinner
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      data-testid="loading"
    >
      <Loader2 className={`${spinnerSize} text-primary animate-spin`} />
      {text && <span className={`${textSize} ml-3 text-gray-700 dark:text-gray-300`}>{text}</span>}
    </div>
  );
}

/**
 * Loading skeleton placeholder component
 */
export function LoadingSkeleton({
  className = '',
  height = 'h-6',
  width = 'w-full',
  rounded = 'rounded-md',
}: {
  className?: string;
  height?: string;
  width?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`${height} ${width} ${rounded} bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}
      data-testid="loading-skeleton"
    />
  );
}

export default Loading;