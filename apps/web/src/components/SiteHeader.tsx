import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  marketingBrandClassName,
  marketingNavActionsClassName,
  marketingNavClassName,
} from "../ui";

/**
 * Shared top nav for standalone pages (pricing, account). Reuses the same brand
 * treatment as the marketing and workspace headers so the chrome stays consistent.
 */
export function SiteHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className={marketingNavClassName}>
      <Link className={marketingBrandClassName} to="/">
        <img alt="" className="size-7" src="/logo.png" />
        <span>OpenCook</span>
      </Link>
      <div className={marketingNavActionsClassName}>{actions}</div>
    </header>
  );
}
