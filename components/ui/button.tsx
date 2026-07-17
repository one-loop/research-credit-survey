import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-primary/95 via-primary to-primary/95 text-primary-foreground border border-t-white/10 border-b-black/20 border-x-black/10 shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_1.5px_0_rgba(255,255,255,0.15)] hover:from-primary hover:to-primary/95 transition-all",
        destructive:
          "bg-gradient-to-b from-destructive/95 via-destructive to-destructive/95 text-white border border-t-white/10 border-b-black/30 border-x-black/20 shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1.5px_0_rgba(255,255,255,0.2)] hover:from-destructive hover:to-destructive/95 transition-all",
        outline:
          "border border-input/80 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-accent hover:text-accent-foreground transition-all",
        secondary:
          "bg-gradient-to-b from-secondary/95 via-secondary to-secondary/95 text-secondary-foreground border border-t-white/20 border-b-black/10 border-x-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.3)] hover:from-secondary hover:to-secondary/95 transition-all",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-all",
        link: "text-primary underline-offset-4 hover:underline transition-all",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
