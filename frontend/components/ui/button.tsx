import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#0F0F10] text-white shadow-sm hover:bg-[#1A1A1E] hover:shadow-md active:scale-[0.98]",
        secondary: "bg-[#0F0F10] text-white hover:bg-[#1A1A1E]",
        outline: "border border-[#E7E5E4] bg-white hover:bg-[#FAFAF9] text-[#0F0F10]",
        ghost: "hover:bg-[#F5F5F4] text-[#57534E] hover:text-[#0F0F10]",
        muted: "bg-[#F5F5F4] text-[#57534E] hover:bg-[#E7E5E4]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-full px-3.5 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
