import type { Catalog, ClosetConfig, Order } from '@/types';
import { formatCents, formatInches, formatStatus } from '@/lib/format';

const STATUS_STYLES: Record<string, string> = {
  received: 'bg-cream text-walnut',
  in_production: 'bg-sand/50 text-ink',
  ready: 'bg-brand/15 text-brand',
  completed: 'bg-brand text-cream',
};

function summarize(catalog: Catalog, config: ClosetConfig) {
  const totalW = config.sections.reduce((a, s) => a + s.widthIn, 0);
  const material =
    catalog.materials.find((m) => m.id === config.materialId)?.label ??
    config.materialId;
  const heightIn = config.heightUpgrade
    ? catalog.constraints.upgradedHeightIn
    : catalog.constraints.standardHeightIn;
  const n = config.sections.length;
  return {
    title: `${n} section${n > 1 ? 's' : ''} · ${material}`,
    sub: `${formatInches(totalW)} W × ${formatInches(
      catalog.constraints.depthIn
    )} D × ${formatInches(heightIn)} H`,
  };
}

export default function OrderCard({
  order,
  catalog,
  children,
}: {
  order: Order;
  catalog: Catalog;
  children?: React.ReactNode;
}) {
  const s = summarize(catalog, order.config);
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-ink">{s.title}</div>
          <div className="mt-0.5 text-xs text-muted">
            {s.sub} · #{order.id.slice(0, 8)}
          </div>
          <div className="mt-0.5 text-xs text-faint">
            {new Date(order.createdAt).toLocaleDateString()}
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            STATUS_STYLES[order.status] ?? 'bg-cream text-muted'
          }`}
        >
          {formatStatus(order.status)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-cream pt-3">
        <span className="text-sm text-muted">Total</span>
        <span className="font-semibold tabular-nums text-ink">
          {formatCents(order.totalCents, order.currency)}
        </span>
      </div>

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
