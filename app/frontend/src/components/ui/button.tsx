import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.42rem] text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'text-white shadow-sm bg-[linear-gradient(135deg,#2F80ED_0%,#4F46E5_58%,#8A2BE2_100%)] hover:brightness-105 hover:shadow-md active:brightness-95',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-[#2F80ED]/30 text-[#2F80ED] bg-white hover:border-[#8A2BE2]/45 hover:text-[#8A2BE2] hover:bg-indigo-50/40',
        secondary:
          'bg-indigo-50 text-[#2F80ED] border border-[#2F80ED]/20 hover:bg-indigo-100/70 hover:text-[#4F46E5]',
        ghost: 'hover:bg-indigo-50/70 hover:text-[#4F46E5]',
        link: 'text-[#2F80ED] underline-offset-4 hover:underline hover:text-[#8A2BE2]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-[0.42rem] px-3',
        lg: 'h-11 rounded-[0.42rem] px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
