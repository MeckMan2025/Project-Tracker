// Scouting is temporarily an "under construction" page while Kayden & Yukti
// rebuild it. (The original form is preserved in git history.)
export default function ScoutingForm() {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 ml-14 flex items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            Scouting
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-5 animate-bounce">🚧</div>
        <h2 className="text-2xl font-extrabold text-gray-700 mb-2">Under Construction</h2>
        <p className="text-gray-500 max-w-xs leading-relaxed">
          <span className="font-bold text-pastel-blue-dark">Kayden</span> and{' '}
          <span className="font-bold text-pastel-pink-dark">Yukti</span> are working on it 🛠️
        </p>
        <p className="text-sm text-gray-400 mt-3">Scouting will be back soon — hang tight!</p>

        <div className="mt-6 flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pastel-blue-dark animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-pastel-pink-dark animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-pastel-orange-dark animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </main>
    </div>
  )
}
