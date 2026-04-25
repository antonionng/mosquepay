import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200/80",
        secondary:
          "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
        outline:
          "border-slate-300 bg-transparent text-slate-800 hover:bg-slate-50",
        destructive:
          "border-transparent bg-red-50 text-red-800 hover:bg-red-100/90",
        success:
          "border-transparent bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80",
        warning:
          "border-transparent bg-amber-50 text-amber-900 hover:bg-amber-100/80",
        muted:
          "border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(badgeVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
