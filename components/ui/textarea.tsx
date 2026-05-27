import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // text-base on phones to disable iOS Safari focus auto-zoom.
          "flex min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 placeholder:text-slate-400 shadow-sm transition-colors focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 resize-none md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
