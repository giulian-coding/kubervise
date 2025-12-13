"use client";

import * as React from "react";
import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";

const Collapsible = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseCollapsible.Root>
>(({ className, ...props }, ref) => (
  <BaseCollapsible.Root ref={ref} className={className} {...props} />
));
Collapsible.displayName = "Collapsible";

const CollapsibleTrigger = BaseCollapsible.Trigger;

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseCollapsible.Panel>
>(({ className, ...props }, ref) => (
  <BaseCollapsible.Panel ref={ref} className={className} {...props} />
));
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
