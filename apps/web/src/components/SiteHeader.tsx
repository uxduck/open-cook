import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { pageContainerClassName } from "../ui";

/**
 * Shared top nav for standalone pages (pricing, account). Reuses the same brand
 * treatment as the marketing and workspace headers so the chrome stays consistent.
 */
export function SiteHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-solid border-[color-mix(in_oklch,var(--color-line)_60%,transparent)] bg-[color-mix(in_oklch,var(--color-panel)_84%,transparent)] shadow-[0_1px_0_color-mix(in_oklch,var(--color-line)_42%,transparent)] backdrop-blur-[16px] backdrop-saturate-[1.3]">
      <div
        className={`${pageContainerClassName} flex min-h-[68px] items-center justify-between gap-3 px-5 py-3 max-[640px]:px-4`}
      >
        <Link
          className="inline-flex min-h-[38px] shrink-0 items-center gap-[9px] rounded-[10px] border-0 bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold tracking-normal text-(--color-ink) transition-opacity duration-[180ms] hover:opacity-[0.66]"
          to="/"
        >
          <img alt="" className="size-7" src="/logo.png" />
          <span>OpenCook</span>
        </Link>
        <nav
          className="flex min-w-0 flex-wrap items-center justify-end gap-2"
          aria-label="Account"
        >
          {actions}
        </nav>
      </div>
    </header>
  );
}
