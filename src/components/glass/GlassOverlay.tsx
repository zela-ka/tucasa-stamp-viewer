import React from 'react';
import { cn } from '@/lib/utils';
import { appBgStyle } from '@/lib/appBackground';

interface GlassOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  onClick?: () => void;
}

export const GlassOverlay = React.forwardRef<HTMLDivElement, GlassOverlayProps>(
  ({ onClick, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn('fixed inset-0 z-40', className)}
        style={appBgStyle}
        {...props}
      />
    );
  }
);

GlassOverlay.displayName = 'GlassOverlay';
