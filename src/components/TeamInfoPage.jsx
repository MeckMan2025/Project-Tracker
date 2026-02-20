import { ArrowLeft } from 'lucide-react'

function TeamInfoPage({ onBack }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/60 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
            The Radical Rundown
          </h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full max-w-sm text-center space-y-4">
          <h2 className="text-xl font-bold text-gray-700">Coming Soon</h2>
          <p className="text-gray-500 text-sm">
            Public team info, stats, and more — stay tuned!
          </p>
          <p className="text-sm font-semibold text-gray-500">
            KAYDEN AND YUKTI ARE WORKING ON IT &lt;3
          </p>
        </div>
      </div>
    </div>
  )
}

export default TeamInfoPage
