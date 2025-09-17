"use client";

import * as React from "react";
import * as MenubarPrimitive from "@radix-ui/react-menubar@1.1.6";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react@0.487.0";

import { cn } from "./utils";

function Menubar({
  className,
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Root>) {
  return (
    <MenubarPrimitive.Root
      data-slot="menubar"
      className={cn(
        "bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

function MenubarMenu({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />;
}

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />;
}

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />;
}

function MenubarRadioGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return (
    <MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
  );
}

const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    data-slot="menubar-trigger"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none",
      className,
    )}
    {...props}
  />
));

const MenubarContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }, ref) => (
  <MenubarPortal>
    <MenubarPrimitive.Content
      ref={ref}
      data-slot="menubar-content"
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-md",
        className,
      )}
      {...props}
    />
  </MenubarPortal>
));

const MenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & { inset?: boolean; variant?: "default" | "destructive" }
>(({ className, inset, variant = "default", ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    data-slot="menubar-item"
    data-inset={inset}
    data-variant={variant}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  />
));

const MenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem
    ref={ref}
    data-slot="menubar-checkbox-item"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <CheckIcon className="size-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
));

const MenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem
    ref={ref}
    data-slot="menubar-radio-item"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <CircleIcon className="size-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
));

const MenubarLabel = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label
    ref={ref}
    data-slot="menubar-label"
    data-inset={inset}
    className={cn(
      "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
      className,
    )}
    {...props}
  />
));

const MenubarSeparator = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator
    ref={ref}
    data-slot="menubar-separator"
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    {...props}
  />
));

function MenubarShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className,
      )}
      {...props}
    />
  );
}

function MenubarSub({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

const MenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger
    ref={ref}
    data-slot="menubar-sub-trigger"
    data-inset={inset}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRightIcon className="ml-auto h-4 w-4" />
  </MenubarPrimitive.SubTrigger>
));

const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent
    ref={ref}
    data-slot="menubar-sub-content"
    className={cn(
      "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
      className,
    )}
    {...props}
  />
));

MenubarTrigger.displayName = "MenubarTrigger";
MenubarContent.displayName = "MenubarContent";
MenubarItem.displayName = "MenubarItem";
MenubarCheckboxItem.displayName = "MenubarCheckboxItem";
MenubarRadioItem.displayName = "MenubarRadioItem";
MenubarLabel.displayName = "MenubarLabel";
MenubarSeparator.displayName = "MenubarSeparator";
MenubarSubTrigger.displayName = "MenubarSubTrigger";
MenubarSubContent.displayName = "MenubarSubContent";

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
