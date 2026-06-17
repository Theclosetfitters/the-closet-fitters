'use client';

import type { ClosetConfig, OptionGroup } from '@/types';
import { formatCents } from '@/lib/format';

interface Props {
  group: OptionGroup;
  selection: ClosetConfig['selections'][string] | undefined;
  onSetSingle: (groupId: string, optionId: string) => void;
  onToggleMulti: (groupId: string, optionId: string) => void;
  onSetQuantity: (groupId: string, optionId: string, qty: number) => void;
}

export default function OptionGroupControl({
  group,
  selection,
  onSetSingle,
  onToggleMulti,
  onSetQuantity,
}: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-zinc-800">
        {group.label}
        {group.required && <span className="ml-1 text-amber-600">*</span>}
      </legend>

      {group.options.map((opt) => {
        const priceLabel =
          opt.priceCents === 0 ? 'Included' : `+${formatCents(opt.priceCents)}`;

        if (group.selectionType === 'single') {
          const selectedIds = (selection as string[]) ?? [];
          const checked = selectedIds.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition ${
                checked
                  ? 'border-amber-600 bg-amber-50'
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={group.id}
                  checked={checked}
                  onChange={() => onSetSingle(group.id, opt.id)}
                  className="accent-amber-600"
                />
                <span>
                  <span className="font-medium text-zinc-800">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-xs text-zinc-500">
                      {opt.description}
                    </span>
                  )}
                </span>
              </span>
              <span className="whitespace-nowrap text-xs text-zinc-500">
                {group.pricingModel === 'per_area'
                  ? `${formatCents(opt.priceCents)}/m²`
                  : priceLabel}
              </span>
            </label>
          );
        }

        if (group.selectionType === 'multi') {
          const selectedIds = (selection as string[]) ?? [];
          const checked = selectedIds.includes(opt.id);
          return (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm hover:border-zinc-300"
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleMulti(group.id, opt.id)}
                  className="accent-amber-600"
                />
                <span className="font-medium text-zinc-800">{opt.label}</span>
              </span>
              <span className="text-xs text-zinc-500">{priceLabel}</span>
            </label>
          );
        }

        // quantity
        const quantities = (selection as Record<string, number>) ?? {};
        const qty = quantities[opt.id] ?? 0;
        return (
          <div
            key={opt.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm"
          >
            <span>
              <span className="font-medium text-zinc-800">{opt.label}</span>
              <span className="block text-xs text-zinc-500">{priceLabel} each</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Decrease ${opt.label}`}
                onClick={() => onSetQuantity(group.id, opt.id, Math.max(0, qty - 1))}
                className="h-7 w-7 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
              >
                −
              </button>
              <span className="w-6 text-center tabular-nums">{qty}</span>
              <button
                type="button"
                aria-label={`Increase ${opt.label}`}
                onClick={() => onSetQuantity(group.id, opt.id, qty + 1)}
                className="h-7 w-7 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
