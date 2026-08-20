import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", {
  variants: {
    variant: {
      default: "border-transparent bg-zinc-900 text-white",
      secondary: "border-transparent bg-zinc-100 text-zinc-900",
      outline: "text-foreground",
      success: "border-transparent bg-emerald-50 text-emerald-700 border-emerald-200",
      warning: "border-transparent bg-amber-50 text-amber-700 border-amber-200",
      danger: "border-transparent bg-rose-50 text-rose-700 border-rose-200",
      private: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
