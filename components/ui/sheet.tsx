"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Native-feel sheet primitive.
//
// - On phone (<sm) the panel slides up from the bottom, honours
//   env(safe-area-inset-bottom) so the close affordance sits above the
//   home-indicator, and locks body scroll while open. This is the iOS
//   bottom-sheet pattern every native app uses.
// - On tablet/desktop (>=sm) the panel can either centre as a modal or
//   slide in from the right depending on `side`.
//
// Migration target: every "fixed inset-0 z-50 flex justify-end" drawer
// across the admin (members add, meetings wizard, sequences editor,
// templates marketplace, etc.). Centralising the chrome lets us evolve
// keyboard handling, focus traps, drag-to-dismiss, etc. once.

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;
const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

type SheetSide = "right" | "bottom" | "center";
type SheetSize = "sm" | "md" | "lg" | "xl" | "full";

type SheetContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: SheetSide;
  size?: SheetSize;
  showClose?: boolean;
};

const sizeToMaxWidth: Record<SheetSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-none",
};

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "right", size = "lg", showClose = true, ...props }, ref) => {
  // Layout rules:
  //   side="right"  -> phone: bottom sheet,        tablet+: right drawer.
  //   side="bottom" -> always a bottom sheet.
  //   side="center" -> phone: bottom sheet,        tablet+: centred modal.
  //
  // We always run the bottom-sheet treatment on phone because no native
  // mobile app slides chrome in from the right edge of the viewport — it
  // confuses one-handed thumb reach and looks like a web page.

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Base on phone: bottom sheet.
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-t-2xl border border-dash-border bg-dash-surface text-dash-text shadow-2xl",
          "pb-[env(safe-area-inset-bottom)]",
          // Animations — slide in/out from the bottom on phone.
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          // Tablet+ resize/reposition based on side prop.
          side === "right" && [
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:max-h-none sm:h-full sm:w-full",
            "sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-y-0 sm:border-r-0",
            "sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right",
            "sm:pb-0",
            sizeToMaxWidth[size],
          ],
          side === "center" && [
            "sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(85dvh,48rem)] sm:w-auto sm:-translate-x-1/2 sm:-translate-y-1/2",
            "sm:rounded-2xl sm:border",
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=open]:slide-in-from-left-1/2",
            "sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-top-[48%]",
            "sm:pb-0",
            sizeToMaxWidth[size],
          ],
          side === "bottom" && "sm:mx-auto sm:max-w-2xl sm:rounded-b-2xl",
          className
        )}
        {...props}
      >
        {/* Drag handle on phone — purely cosmetic, gives the user the
            "this is a sheet you can dismiss" affordance without us
            having to implement actual touch drag yet. */}
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-dash-border-strong/60 sm:hidden"
          aria-hidden
        />
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-3 top-3 rounded-lg p-1.5 text-dash-muted transition-colors",
              "hover:bg-dash-surface-subtle hover:text-dash-text",
              "focus:outline-none focus:ring-2 focus:ring-dash-ring focus:ring-offset-2 focus:ring-offset-dash-surface",
              "disabled:pointer-events-none"
            )}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-col gap-1 border-b border-dash-border bg-dash-surface px-5 py-4 sm:px-6 sm:py-4",
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5", className)} {...props} />
);
SheetBody.displayName = "SheetBody";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Sticky on phone so the primary action stays in thumb reach when
      // a long form pushes content below the fold. Honours bottom safe-area.
      "sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 border-t border-dash-border bg-dash-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:gap-2 sm:px-6 sm:py-4 sm:pb-4",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold leading-tight tracking-tight text-dash-text sm:text-lg",
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-dash-muted", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
