import { RANGES, type Range } from '../lib/sites'

/** The time frame selector. One definition so every surface offers the same
 *  windows and they read the same way. */
export function RangePills({
  value,
  onChange,
  className = '',
}: {
  value: Range
  onChange: (range: Range) => void
  className?: string
}) {
  return (
    <div className={`no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5 ${className}`}>
      {RANGES.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={`press shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
            value === option.id ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
