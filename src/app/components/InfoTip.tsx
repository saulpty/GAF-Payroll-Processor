import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const BUBBLE_WIDTH = 240; // the bubble's max width, in px (max-w-[240px] below)
const EDGE = 8;           // room kept between the bubble and the edge of the screen, in px

// Hovering still shows the browser's own tooltip (title). A click or a tap also opens a small
// bubble with the same text, because a touch screen has no hover. The bubble is drawn on
// document.body with position: fixed, so a scrolling table cannot cut it off; it closes on a
// click or tap anywhere else, on Esc, and as soon as anything scrolls or the window resizes.
// This stays a <span>, never a <button>: DataTable puts it inside the header's sort <button>, and
// a button inside a button is invalid. stopPropagation keeps the click from also sorting.
export default function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (tipRef.current?.contains(t) || bubbleRef.current?.contains(t))) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggle() {
    if (open) { setPos(null); return; }
    const r = tipRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(EDGE, Math.min(r.left - EDGE, window.innerWidth - BUBBLE_WIDTH - EDGE));
    // Under the icon; above it when the icon is near the bottom of the screen.
    setPos(r.bottom + 120 > window.innerHeight
      ? { left, bottom: window.innerHeight - r.top + 6 }
      : { left, top: r.bottom + 6 });
  }

  // Also runs for a click on the open bubble (React passes it up through the portal): it closes.
  function onClick(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }

  return (
    <span
      ref={tipRef}
      role="button"
      tabIndex={0}
      title={open ? undefined : text}
      aria-label={text}
      aria-expanded={open}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="relative inline-flex align-[-1px] ml-1 cursor-help [@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-2 [@media(pointer:coarse)]:before:content-['']"
    >
      <Info className="w-3 h-3 text-slate-400" aria-hidden="true" />
      {open && createPortal(
        <span
          ref={bubbleRef}
          role="tooltip"
          style={pos ?? undefined}
          className="fixed z-[60] block w-max max-w-[240px] cursor-default whitespace-normal rounded-md bg-slate-900 px-2.5 py-1.5 text-left text-[12px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
