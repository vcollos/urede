"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const DEFAULT_THEME: ToasterProps["theme"] = "light";

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme={DEFAULT_THEME}
    className="toaster group"
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
      } as CSSProperties
    }
    {...props}
  />
);

export { Toaster };
