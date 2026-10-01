import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-white/[0.03] px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-white/[0.05] focus-visible:border-ember/60 focus-visible:bg-white/[0.05] focus-visible:ring-3 focus-visible:ring-ember/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/25 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
