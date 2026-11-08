import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Home } from './screens/Home'
import { ReportFlow } from './screens/ReportFlow'
import api, { type ApiCategory, type User } from './lib/api-client'
import './index.css'

const q = new URLSearchParams(location.search)
const s = q.get('s') ?? 'map'
if (q.get('tok')) localStorage.setItem('auth_token', q.get('tok') as string)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const g = api as unknown as Record<string, Record<string, unknown>>
const user = { _id: 'u', phone: '+13054328800', status: 'active', displayName: 'Jordan S' } as User
g.getPosition = async () => ({ lat: 25.7743, lng: -80.1937, accuracy: 8 })
;(g.reports as Record<string, unknown>).analyze = async () => ({
  draftId: 'd', expiresInHours: 24, photo: '/__t/shot.jpg', location: { lat: 25.7743, lng: -80.1937 },
  ai: { available: true, reason: null, model: 'claude-opus-5-5', looksLikeCategory: true, confidence: 0.85, rejectionReason: null },
  proposal: { subType: 'pothole', severity: 3, description: 'Shallow pothole roughly 3 by 2 feet, about 1-2 inches deep, in asphalt along the gutter edge.', hazards: [] },
  subtypeOptions: [{ code: 'pothole', label: 'Pothole' }, { code: 'worn-roadway', label: 'Roadway is worn or has defects' }],
  nearby: [
    { siteId: 'a', distanceMeters: 14, reportCount: 4, endorsementCount: 1, totalVoices: 5, address: '2200 NW 70TH AVE', statusLabel: 'Open 101 days', thumbnail: '/__t/n1.jpg' },
    { siteId: 'b', distanceMeters: 62, reportCount: 2, endorsementCount: 0, totalVoices: 2, address: '2140 NW 69TH ST', statusLabel: 'Open 28 days', thumbnail: '/__t/n2.jpg' },
  ],
})
const category = { code: 'pothole', label: 'Pothole or roadway defect', group: 'roads', subtypes: [] } as unknown as ApiCategory
async function feedPhoto() {
  const blob = await (await fetch('/__t/shot.jpg')).blob()
  for (let i = 0; i < 80; i++) {
    const inp = document.querySelectorAll<HTMLInputElement>('input[type=file]')[0]
    if (inp) { const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.jpg', { type: 'image/jpeg' }))
      Object.defineProperty(inp, 'files', { value: dt.files, configurable: true })
      inp.dispatchEvent(new Event('change', { bubbles: true })); return }
    await wait(200) }
}
async function scrollTo(re: RegExp) {
  for (let i = 0; i < 30; i++) {
    const pane = [...document.querySelectorAll<HTMLElement>('.no-scrollbar')].find((e) => e.scrollHeight > e.clientHeight + 4)
    const t = [...document.querySelectorAll<HTMLElement>('section, h3, p')].find((e) => re.test(e.textContent ?? ''))
    if (pane && t) { const c = t.closest('section') ?? t
      pane.scrollTop = c.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 12; return }
    await wait(300) }
}
function Frame({ children }: { children: React.ReactNode }) {
  return (<div className="flex h-full justify-center bg-[#f0f0f0]">
    <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-surface">{children}</div></div>)
}
function Scene() {
  const [, force] = useState(0)
  useEffect(() => { const run = async () => {
    await wait(3500)
    if (s === 'ai') { await feedPhoto(); await wait(2500) }
    if (s === 'fixcheck') {
      for (let i = 0; i < 40; i++) {
        const rows = [...document.querySelectorAll<HTMLButtonElement>('ul li button')]
        const hit = rows.find((r) => r.textContent?.includes('SW 37th')) ?? rows[0]
        if (hit) { hit.click(); break } ; await wait(250) }
      await wait(2500); await scrollTo(/DISAGREE|Checked by neighbours/i) }
    if (s === 'wide') {
      const m = document.querySelector('.leaflet-container') as HTMLElement
      for (let i = 0; i < 3; i++) { m?.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true, clientX: 215, clientY: 170 })); await wait(900) }
      await wait(6000) }
    if (s === 'map') await wait(4000)
    force((n) => n + 1) }; run() }, [])
  if (s === 'ai') return <Frame><ReportFlow category={category} onClose={() => {}} onFiled={() => {}} /></Frame>
  return <Frame><Home user={user} onSignedOut={() => {}} /></Frame>
}
createRoot(document.getElementById('root')!).render(<Scene />)
