import { Check, Dot } from 'lucide-react';

type Props = { official: boolean; edited: boolean };

export default function SourceBadge({ official, edited }: Props) {
  if (!official) {
    return <span className="text-xs text-slate-400 italic">Live</span>;
  }
  if (edited) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-indigo-600">
        <Dot className="w-3 h-3" />
        Official, Edited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600">
      <Check className="w-3 h-3" />
      Official
    </span>
  );
}
