import { Info } from 'lucide-react';

export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="inline-flex align-[-1px] ml-1 cursor-help" title={text} aria-label={text} tabIndex={0}>
      <Info className="w-3 h-3 text-slate-400" aria-hidden="true" />
    </span>
  );
}
