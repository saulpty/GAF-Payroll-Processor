import { Info } from 'lucide-react';

export default function InfoTip({ text }: { text: string }) {
  return <Info className="inline-block w-3 h-3 ml-1 text-slate-400 align-[-1px]" aria-label={text} title={text} />;
}
