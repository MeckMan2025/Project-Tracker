function LandingScreen({ onGetRadical, onRadicalRundown }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pastel-blue/30 via-pastel-pink/20 to-pastel-orange/30 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-80 space-y-6 text-center">
        <img
          src="/ScrumLogo.png"
          alt="Scrum Logo"
          className="w-24 h-24 mx-auto rounded-2xl shadow-md"
        />
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
          Everything That's Radical
        </h1>

        <button
          onClick={onGetRadical}
          className="w-full py-3 bg-pastel-pink hover:bg-pastel-pink-dark rounded-xl font-semibold text-gray-700 transition-colors text-lg"
        >
          Get Radical
        </button>

        <p className="text-xs text-gray-400">
          Team members sign in above. Scouts &amp; visitors, check us out below!
        </p>

        <button
          onClick={onRadicalRundown}
          className="w-full py-3 bg-pastel-blue hover:bg-pastel-blue-dark rounded-xl font-semibold text-gray-700 transition-colors text-lg"
        >
          The Radical Rundown
        </button>
      </div>
    </div>
  )
}

export default LandingScreen
