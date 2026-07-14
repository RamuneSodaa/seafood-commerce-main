import Link from 'next/link';
import type { ReactNode } from 'react';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function AdminPage({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  children
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}) {
  return (
    <main className="admin-shell">
      <div className="admin-stack">
        <section className="admin-hero">
          {breadcrumbs?.length ? (
            <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbs.map((item, idx) => (
                <span key={`${item.label}-${idx}`} className="admin-breadcrumb-item">
                  {item.href ? <Link href={item.href}>{item.label}</Link> : <span className="admin-breadcrumb-current">{item.label}</span>}
                  {idx < breadcrumbs.length - 1 ? <span className="admin-breadcrumb-sep">/</span> : null}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="admin-hero-copy">
            {eyebrow ? <div className="admin-eyebrow">{eyebrow}</div> : null}
            <h1 className="admin-title">{title}</h1>
            <p className="admin-description">{description}</p>
          </div>
          {actions ? <div className="admin-hero-actions">{actions}</div> : null}
        </section>
        {children}
      </div>
    </main>
  );
}

export function AdminSection({
  title,
  description,
  children
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-card">
      {title ? <h2 className="admin-section-title">{title}</h2> : null}
      {description ? <p className="admin-section-description">{description}</p> : null}
      {children}
    </section>
  );
}

export function AdminAlert({
  title = '出现问题',
  message,
  tone = 'danger'
}: {
  title?: string;
  message: string;
  tone?: 'danger' | 'info' | 'success';
}) {
  return (
    <section className={`admin-alert admin-alert-${tone}`} role="alert">
      <h2 className="admin-alert-title">{title}</h2>
      <p className="admin-alert-copy">{message}</p>
    </section>
  );
}

export function AdminEmpty({
  title,
  message,
  action
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section className="admin-empty">
      <h2 className="admin-alert-title">{title}</h2>
      <p className="admin-alert-copy">{message}</p>
      {action}
    </section>
  );
}

export function AdminBadge({
  tone = 'neutral',
  children
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'danger';
  children: ReactNode;
}) {
  return <span className={`admin-badge admin-badge-${tone}`}>{children}</span>;
}

export function AdminLoadingBlocks({ count = 3 }: { count?: number }) {
  return (
    <div className="admin-loading-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx} className="admin-loading-block" />
      ))}
    </div>
  );
}
