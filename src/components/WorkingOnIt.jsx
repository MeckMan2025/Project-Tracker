import NotificationBell from './NotificationBell'

// The standard "not built yet" screen — the one AI Manual has always used.
// Any tab that needs a placeholder renders this so they all stay identical.
export default function WorkingOnIt({ title }) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              {title}
            </h1>
          </div>
          <NotificationBell />
        </div>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-5 animate-bounce">🚧</div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-700 mb-2">Under Construction</h2>
        <p className="text-gray-500 max-w-sm">
          <span className="font-semibold text-pastel-blue-dark">Kayden</span> and{' '}
          <span className="font-semibold text-pastel-pink-dark">Yukti</span> are working on it 🛠️
        </p>
      </div>
    </div>
  )
}
