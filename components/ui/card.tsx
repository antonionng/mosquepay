import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "elegant" | "gold" | "flat" | "kpi" | "panel";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default:
      "bg-white border border-slate-200 shadow-card hover:border-slate-300 hover:shadow-card-hover",
    elegant:
      "bg-white border border-slate-200 shadow-elegant hover:border-blue-200 hover:shadow-elegant-lg",
    gold:
      "bg-gradient-to-br from-blue-50 to-white border border-blue-100 shadow-soft hover:shadow-gold",
    flat: "bg-slate-50 border border-slate-200",
    kpi:
      "rounded-xl border border-dash-border bg-dash-surface p-5 shadow-dash transition-shadow duration-200 hover:border-dash-border-strong hover:shadow-dash-raised",
    panel:
      "rounded-xl border border-dash-border bg-dash-surface shadow-sm",
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[1.25rem] transition-all duration-300",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-6 md:p-8", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-semibold leading-tight text-slate-950", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-relaxed text-slate-600", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 md:p-8 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 md:p-8 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
