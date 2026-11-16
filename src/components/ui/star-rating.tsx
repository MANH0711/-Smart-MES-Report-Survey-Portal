import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StarRatingProps {
  value: number;
  onChange: (val: number) => void;
  label?: string;
  max?: number;
}

export function StarRating({ value, onChange, label, max = 5 }: StarRatingProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label || 'Rating'}>
        {Array.from({ length: max }, (_, idx) => idx + 1).map((n) => {
          const active = n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} of ${max}`}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                active
                  ? 'border-amber-400 bg-amber-50 text-amber-500 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-600'
              )}
            >
              <Star className={cn('h-3.5 w-3.5', active && 'fill-current')} />
            </button>
          );
        })}
        <span className="ml-1.5 text-[12px] font-mono-num text-slate-500 dark:text-slate-400">{value}/{max}</span>
      </div>
    </div>
  );
}
