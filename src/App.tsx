import { useEffect, useState } from 'react'
import { SignIn } from './screens/SignIn'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Community } from './screens/Community'
import { TabBar, type Tab } from './components/TabBar'
import api, { type User } from './lib/api-client'

type View = 'loading' | 'signIn' | 'onboarding' | 'signedIn'

export default function App() {
  const [view, setView] = useState<View>('loading')
  const [, setUser] = useState<User | null>(null)
  const [phone, setPhone] = useState('')
  const [tab, setTab] = useState<Tab>('home')
  // A fresh object each time, so tapping the same report twice focuses it again.
  const [focus, setFocus] = useState<{ id: string } | null>(null)

  // Restore the session on load. The client clears the token itself on a 401.
  useEffect(() => {
    if (!api.auth.isSignedIn()) {
      setView('signIn')
      return
    }
    api.session
      .me()
      .then((u) => {
        setUser(u)
        setView('signedIn')
      })
      .catch(() => setView('signIn'))
  }, [])

  const signedIn = (u: User) => {
    setUser(u)
    setView('signedIn')
  }

  if (view === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-surface">
        <span className="animate-loop size-6 rounded-full border-2 border-line border-t-ink" />
      </div>
    )
  }

  if (view === 'onboarding') {
    return (
      <Onboarding
        initialPhone={phone}
        onSignedIn={signedIn}
        onCancel={() => setView('signIn')}
      />
    )
  }

  if (view === 'signedIn') {
    return (
      <div className="flex h-full justify-center bg-[#f0f0f0]">
        <div className="relative flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-surface">
          {tab === 'home' ? (
            <Home focus={focus} />
          ) : (
            <Community
              onOpenReport={(id) => {
                setFocus({ id })
                setTab('home')
              }}
            />
          )}
          <TabBar active={tab} onChange={setTab} />
        </div>
      </div>
    )
  }

  return (
    <SignIn
      onSignedIn={signedIn}
      onNeedsOnboarding={(p) => {
        setPhone(p)
        setView('onboarding')
      }}
    />
  )
}
