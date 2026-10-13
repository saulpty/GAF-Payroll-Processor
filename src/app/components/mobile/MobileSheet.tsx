import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** 'partial' hugs the bottom and is as tall as its content; 'full' takes the screen's height. */
  size?: 'partial' | 'full';
  /** Keep the children alive while the sheet is closed (their effects and loaders keep running). */
  keepMounted?: boolean;
  children: ReactNode;
};

const BODY = 'flex-1 min-h-0 overflow-y-auto overscroll-contain';

// keepMounted: the children are rendered ONCE, into `host`, a DOM node this component owns.
// While the sheet is closed the node is parked in a hidden <div>; while it is open the node is
// moved into the sheet's body. Moving a DOM node does not remount anything, so the children keep
// their state and their effects do not run again each time the sheet opens or closes.
function SheetBody({ host, parkRef }: { host: HTMLElement; parkRef: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    slot.appendChild(host);
    return () => {
      const park = parkRef.current;
      if (park) park.appendChild(host);
      else host.remove();
    };
  }, [host, parkRef]);
  return <div ref={ref} className={BODY} />;
}

/** The one slide-up surface on a phone. Built on the app's dialog: focus, Esc and scroll lock come from it. */
export default function MobileSheet({
  open, onClose, title, subtitle, size = 'partial', keepMounted = false, children,
}: Props) {
  const subtitleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const parkRef = useRef<HTMLDivElement>(null);
  const [host] = useState<HTMLDivElement | null>(() =>
    typeof document === 'undefined' ? null : document.createElement('div'));
  const kept = keepMounted && host !== null;

  // First placement: park the node unless the sheet's body has already taken it.
  useLayoutEffect(() => {
    if (kept && host && !host.parentNode && parkRef.current) parkRef.current.appendChild(host);
  }, [kept, host]);

  return (
    <>
      {kept && host && (
        <>
          <div ref={parkRef} hidden />
          {createPortal(children, host)}
        </>
      )}
      <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
        <DialogContent
          ref={contentRef}
          aria-describedby={subtitle ? subtitleId : undefined}
          // Kept children are not this dialog's React children, so the dialog would read a tap on
          // them as a tap outside and close. A tap that lands inside the sheet never closes it.
          onInteractOutside={e => {
            const target = (e.detail?.originalEvent?.target ?? e.target) as Node | null;
            if (target && contentRef.current?.contains(target)) e.preventDefault();
          }}
          className={cn(
            'left-0 top-auto bottom-0 translate-x-0 translate-y-0 max-w-none rounded-none rounded-t-lg p-0',
            'flex flex-col overflow-hidden [&>button:last-child]:hidden',
            size === 'full' ? 'h-[calc(100%-2rem)]' : 'max-h-[85%]',
          )}
        >
          <div className="shrink-0 min-h-14 flex items-center gap-2 pl-4 pr-1 border-b border-border">
            <div className="flex-1 min-w-0 py-2">
              <DialogTitle className="text-[16px] font-semibold text-foreground">{title}</DialogTitle>
              {subtitle && (
                <p id={subtitleId} className="text-[13px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <DialogClose
              aria-label="Close"
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </DialogClose>
          </div>
          {kept && host
            ? <SheetBody host={host} parkRef={parkRef} />
            : <div className={BODY}>{children}</div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
