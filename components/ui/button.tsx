"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-slate-950 text-white shadow-soft hover:bg-slate-800 focus-visible:ring-blue-500 focus-visible:ring-offset-white",
        primary:
          "bg-brand text-white shadow-sm hover:bg-brand-dark focus-visible:ring-brand focus-visible:ring-offset-white",
        brand:
          "bg-brand text-white shadow-sm hover:bg-brand-dark focus-visible:ring-brand focus-visible:ring-offset-white",
        secondary:
          "border border-slate-400 bg-slate-50 text-slate-950 shadow-sm hover:border-slate-500 hover:bg-slate-100 focus-visible:ring-blue-500 focus-visible:ring-offset-white",
        ghost:
          "border border-transparent text-slate-800 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-blue-500 focus-visible:ring-offset-white",
        outline:
          "border border-slate-400 bg-slate-50 text-slate-950 shadow-sm hover:border-slate-500 hover:bg-slate-100 focus-visible:ring-blue-500 focus-visible:ring-offset-white",
        "outline-gold":
          "border border-blue-200 bg-blue-50/40 text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-500 focus-visible:ring-offset-white",
        link:
          "h-auto p-0 text-blue-600 underline-offset-4 hover:text-blue-700 hover:underline focus-visible:ring-blue-500 focus-visible:ring-offset-white",
        destructive:
          "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500 focus-visible:ring-offset-white",
        dashboard:
          "border border-dash-border bg-dash-surface text-dash-text shadow-sm hover:border-dash-border-strong hover:bg-dash-surface-subtle focus-visible:ring-dash-ring focus-visible:ring-offset-dash-surface",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-base",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
