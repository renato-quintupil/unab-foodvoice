'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-[var(--color-borde)] bg-transparent px-3 py-2 text-sm',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-[var(--color-error)]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
