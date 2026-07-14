import type { ReactNode } from 'react';
import Link from 'next/link';

import { formatPriceCents } from '../lib/format';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
};

export function PageShell({ eyebrow, title, description, actions, children, breadcrumbs }: PageShellProps) {
  return (
    <main className="storefront-shell">
      <div className="page-stack">
        <section className="page-hero">
          {breadcrumbs?.length ? (
            <nav className="breadcrumb-row" aria-label="Breadcrumb">
              {breadcrumbs.map((item, idx) => (
                <span key={`${item.label}-${idx}`} className="breadcrumb-item">
                  {item.href ? (
                    <Link className="breadcrumb-link" href={item.href}>
                      {item.label}
                    </Link>
                  ) : (
                    <span className="breadcrumb-current">{item.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 ? <span className="breadcrumb-separator">/</span> : null}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="hero-copy">
            {eyebrow ? <div className="hero-eyebrow">{eyebrow}</div> : null}
            <h1 className="hero-title">{title}</h1>
            <p className="hero-description">{description}</p>
          </div>
          {actions ? <div className="hero-actions">{actions}</div> : null}
        </section>
        {children}
      </div>
    </main>
  );
}

type SectionCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="section-card">
      {title ? <h2 className="section-title">{title}</h2> : null}
      {description ? <p className="section-copy">{description}</p> : null}
      {children}
    </section>
  );
}

type AlertMessageProps = {
  title?: string;
  message: string;
};

export function AlertMessage({ title = '出现问题', message }: AlertMessageProps) {
  return (
    <section className="alert-message" role="alert">
      <h2 className="alert-title">{title}</h2>
      <p className="alert-copy">{message}</p>
    </section>
  );
}

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h2 className="empty-title">{title}</h2>
      <p className="empty-copy">{message}</p>
      {action}
    </section>
  );
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx} className="skeleton-card" />
      ))}
    </div>
  );
}

type PriceBlockProps = {
  label: string;
  amountCents: number;
};

export function PriceBlock({ label, amountCents }: PriceBlockProps) {
  return (
    <div className="price-block">
      <span className="price-label">{label}</span>
      <span className="price-value">{formatPriceCents(amountCents)}</span>
    </div>
  );
}

type BadgeProps = {
  tone?: 'neutral' | 'accent' | 'success';
  children: ReactNode;
};

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
