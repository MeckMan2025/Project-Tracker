import { Hammer } from 'lucide-react'
import NotificationBell from './NotificationBell'

// Placeholder for tabs that exist in the nav but aren't built yet. Keeps the
// same header shape as a real view so the page doesn't jump when it lands.
export default function WorkingOnIt({ title, blurb }) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 pl-14 md:pl-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-sm text-gray-500">Coming soon</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-pastel-orange/30 flex items-center justify-center">
          <Hammer size={28} className="text-pastel-orange-dark" />
        </div>
        <h2 className="text-lg font-bold text-gray-600">We're working on it</h2>
        <p className="text-sm text-gray-400 text-center max-w-xs">
          {blurb || `${title} isn't ready yet. It'll show up here once it's built.`}
        </p>
      </main>
    </div>
  )
}
