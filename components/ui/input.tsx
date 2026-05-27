import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  // text-base on phones (>=16px) prevents iOS Safari auto-zoom on focus.
  // text-sm at md+ keeps desktop tight. Apply to single-line inputs which
  // is the only place iOS Safari triggers the zoom behaviour.
  "flex h-11 w-full rounded-xl px-4 py-2 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  {
    variants: {
      variant: {
        default:
          "border border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20",
        dashboard:
          "border border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint focus-visible:border-dash-ring focus-visible:ring-dash-ring/20 focus-visible:ring-offset-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
