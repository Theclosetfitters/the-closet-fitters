'use client';

import type { ClosetType, Dimensions } from '@/types';

interface Props {
  closetType: ClosetType;
  dimensions: Dimensions;
  onChange: (key: keyof Dimensions, value: number) => void;
}

const KEYS: (keyof Dimensions)[] = ['width', 'height', 'depth'];

export default function DimensionControls({
  closetType,
  dimensions,
  onChange,
}: Props) {
  return (
    <div className="space-y-4">
      {KEYS.map((key) => {
        const range = closetType.dimensions[key];
        const value = dimensions[key];
        return (
          <div key={key}>
            <div className="flex items-center justify-between text-sm">
              <label className="font-medium capitalize text-zinc-700">
                {key}
              </label>
              <span className="tabular-nums text-zinc-500">{value} cm</span>
            </div>
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={1}
              value={value}
              onChange={(e) => onChange(key, Number(e.target.value))}
              className="mt-1 w-full accent-amber-600"
            />
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>{range.min}</span>
              <span>{range.max}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
