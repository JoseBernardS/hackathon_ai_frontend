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
    <div className={`segbar ${className}`}>
      {RANGES.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className="press seg"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
