import Link from "next/link";
import { ReactNode } from "react";

export function Button({
  children,
  variant = "solid",
  href,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  variant?: "solid" | "ghost";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "solid"
      ? `${base} bg-marigold text-board hover:bg-marigolddim`
      : `${base} bg-transparent text-chalkdim border border-board3 hover:text-chalk hover:bg-board2`;
  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3.5 py-2.5 text-sm text-left transition-colors ${
        active
          ? "bg-marigold border-marigold text-board font-semibold"
          : "bg-board2 border-board3 text-chalk hover:border-marigold"
      }`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-board3 bg-board2 p-6 ${className}`}>{children}</div>
  );
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-marigold">{eyebrow}</div>
      )}
      <h1 className="font-display text-3xl text-chalk">{title}</h1>
      {subtitle && <p className="mt-2 max-w-prose text-sm text-chalkdim">{subtitle}</p>}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-chalkdim">{label}</div>
      <div className="mt-1 font-display text-2xl text-chalk">{value}</div>
    </Card>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-board3 p-8 text-center text-sm text-chalkdim">
      {text}
    </div>
  );
}
