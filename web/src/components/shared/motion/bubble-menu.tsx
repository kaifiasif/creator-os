import { KeyboardIcon, MoonIcon, PlusIcon, SearchIcon, SunIcon, XIcon, ZapIcon, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/app/theme';
import { openOverlay } from '@/app/ui-state';
import { cn } from '@/lib/utils';

interface Bubble {
  label: string;
  icon: LucideIcon;
  run: () => void;
}

/**
 * Quick actions in the bottom corner: one round button that pops out a column of labelled bubbles,
 * one after another. Escape or a click outside closes it; every bubble is a real button.
 */
export function BubbleMenu() {
  const [open, setOpen] = useState(false);
  const { resolved, setTheme } = useTheme();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const bubbles: Bubble[] = [
    { label: 'New capture', icon: PlusIcon, run: () => openOverlay('capture') },
    { label: 'Search', icon: SearchIcon, run: () => openOverlay('command') },
    { label: 'Keyboard shortcuts', icon: KeyboardIcon, run: () => openOverlay('shortcuts') },
    { label: resolved === 'dark' ? 'Light mode' : 'Dark mode', icon: resolved === 'dark' ? SunIcon : MoonIcon, run: () => setTheme(resolved === 'dark' ? 'light' : 'dark') },
  ];

  return (
    <div ref={root} className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-2">
      {open && (
        <ul id="quick-actions" className="flex flex-col items-end gap-2">
          {bubbles.map((b, i) => (
            <li key={b.label} className="bubble" style={{ animationDelay: `${(bubbles.length - 1 - i) * 45}ms` }}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  b.run();
                }}
                className="flex items-center gap-2 rounded-full border bg-popover py-2 pr-4 pl-3 text-sm font-medium shadow-lg shadow-black/10 transition-[translate,background-color] outline-none hover:-translate-x-1 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <b.icon className="size-4 text-muted-foreground" />
                {b.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        aria-label={open ? 'Close quick actions' : 'Quick actions'}
        aria-expanded={open}
        aria-controls="quick-actions"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-black/20 transition-[scale,rotate] outline-none hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95',
          open && 'rotate-90',
        )}
      >
        {open ? <XIcon className="size-5" /> : <ZapIcon className="size-5" />}
      </button>
    </div>
  );
}
