import { fmtClock } from '@/app/lib/teramindToday';

const TIP = 'A Teramind record of a few minutes followed by an hour or more of nothing is treated as a computer event, not an arrival.';

type Props = { ghostMin: number | null };

export default function GhostMark({ ghostMin }: Props) {
  if (ghostMin === null) return null;
  return (
    <div className="text-[10px] leading-tight text-slate-400 mt-0.5 whitespace-nowrap" title={TIP}>
      Early Record {fmtClock(ghostMin)} Ignored
    </div>
  );
}
