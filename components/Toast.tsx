'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: 'bg-accent/20 border-accent text-accent',
    error: 'bg-danger/20 border-danger text-danger',
    info: 'bg-secondary/20 border-secondary text-secondary',
  };

  return (
    <div className={`fixed bottom-24 left-1/2 z-[60] max-w-[calc(100vw-2rem)] px-4 py-2.5 rounded-xl border font-medium text-sm whitespace-nowrap ${colors[type]} ${exiting ? 'toast-exit' : 'toast-enter'}`}>
      {message}
    </div>
  );
}
