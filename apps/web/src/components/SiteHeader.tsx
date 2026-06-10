import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Shared top nav for standalone pages (pricing, account). Reuses the same brand
 * treatment as the marketing and workspace headers so the chrome stays consistent.
 */
export function SiteHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="marketing-nav">
      <Link className="marketing-brand" to="/">
        <img alt="" className="brand-logo" src="/logo.png" />
        <span>OpenCook</span>
      </Link>
      <div className="marketing-nav-actions">{actions}</div>
    </header>
  );
}
