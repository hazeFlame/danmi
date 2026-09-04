import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  rounded = "pill",
  ...props
}: React.ComponentProps<"input"> & { rounded?: "pill" | "lg" | "default" }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9.5 w-full min-w-0 border border-border bg-card px-3.5 py-1.5 text-sm text-foreground shadow-2xs transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-secondary focus-visible:ring-[3px] focus-visible:ring-secondary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        rounded === "pill" ? "rounded-full" : "rounded-xl",
        className
      )}
      {...props}
    />
  )
}

export { Input }
