'use client';

import { useEffect, useRef, useState } from 'react';
import { generateTimezoneList, type TimezoneEntry } from '@/lib/timezone';
import { useTimezone } from '@/components/timezone-context';

export function TimezonePicker() {
  const { timezone, setTimezone } = useTimezone();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [zones, setZones] = useState<TimezoneEntry[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZones(generateTimezoneList());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = zones.find((z) => z.value === timezone);
  const filtered = zones.filter(
    (z) =>
      !query ||
      z.label.toLowerCase().includes(query.toLowerCase()) ||
      z.value.toLowerCase().includes(query.toLowerCase()) ||
      z.offset.toLowerCase().includes(query.toLowerCase()) ||
      z.abbreviation.toLowerCase().includes(query.toLowerCase())
  );

  function openDropdown() {
    setOpen(true);
    setHighlightIndex(0);
  }

  function selectZone(tz: TimezoneEntry) {
    setTimezone(tz.value);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        openDropdown();
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setHighlightIndex((i) => Math.max(i - 1, 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (filtered[highlightIndex]) {
          selectZone(filtered[highlightIndex]);
        }
        e.preventDefault();
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        e.preventDefault();
        break;
    }
  }

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, open]);

  return (
    <div ref={containerRef} className="relative w-72">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search timezone..."
        value={open ? query : selected?.label || 'UTC'}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          setHighlightIndex(0);
        }}
        onFocus={() => {
          if (!open) openDropdown();
        }}
        onKeyDown={handleKeyDown}
        className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      {open && (
        <div
          ref={listRef}
          className="absolute right-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md"
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No timezones found
            </div>
          ) : (
            filtered.map((z, i) => (
              <button
                key={z.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectZone(z);
                }}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${
                  i === highlightIndex ? 'bg-accent' : ''
                } ${z.value === timezone ? 'font-medium' : ''}`}
              >
                <span className="shrink-0 font-mono text-muted-foreground">
                  {z.offset}
                </span>
                <span className="truncate">{z.value}</span>
                {z.abbreviation && (
                  <span className="shrink-0 text-muted-foreground">
                    ({z.abbreviation})
                  </span>
                )}
                {z.value === timezone && (
                  <span className="ml-auto shrink-0 text-primary">✓</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
