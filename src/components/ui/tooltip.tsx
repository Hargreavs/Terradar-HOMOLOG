import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ side = 'top', align = 'center', sideOffset = 8, style, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      side={side}
      align={align}
      sideOffset={sideOffset}
      style={{
        maxWidth: 280,
        padding: '8px 12px',
        fontSize: 12,
        lineHeight: 1.45,
        backgroundColor: '#18181b',
        color: '#e4e4e7',
        borderRadius: 6,
        zIndex: 10070,
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.25)',
        ...style,
      }}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName ?? 'TooltipContent'

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
