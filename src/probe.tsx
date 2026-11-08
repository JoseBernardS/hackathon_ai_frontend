import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Home } from './screens/Home'
import './index.css'

function Shell() {
  useEffect(() => {
    // Open the first case so the detail pane is what gets measured.
    const t = setTimeout(() => {
      document.querySelectorAll<HTMLButtonElement>('ul li button')[0]?.click()
    }, 6500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="flex h-full justify-center bg-[#f0f0f0]">
      <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-surface">
        <Home />
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<Shell />)
