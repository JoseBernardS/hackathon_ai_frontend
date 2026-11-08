import { Map, Users } from 'lucide-react'

export type Tab = 'home' | 'community'

const TABS: { id: Tab; label: string; Icon: typeof Map }[] = [
  { id: 'home', label: 'Home', Icon: Map },
  { id: 'community', label: 'Community', Icon: Users },
]

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="flex h-14 items-stretch">
        {TABS.map(({ id, label, Icon }) => {
          const on = id === active
          return (
            <li key={id} className="flex-1">
              <button
                onClick={() => onChange(id)}
                aria-current={on ? 'page' : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-1 ${
                  on ? 'text-ink' : 'text-ink-3'
                }`}
              >
                <Icon size={22} strokeWidth={on ? 2.4 : 1.8} />
                <span className={`text-[11px] ${on ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
