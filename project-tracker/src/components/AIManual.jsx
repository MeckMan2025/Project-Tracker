import { useState } from 'react'
import { ExternalLink, RefreshCw, Bot } from 'lucide-react'

// FIRST's own chatbot for the Competition Manual. It answers rules questions
// out of the current manual, which is the thing people were opening a second
// tab for — so it lives in a tab here instead.
//
// It is embedded rather than rebuilt: the answers have to come from FIRST to be
// worth trusting in a match, and their page sets no frame restrictions. If that
// ever changes the iframe goes blank, so the "Open in a new tab" link is always
// there rather than only appearing on an error we cannot reliably detect.
const CHATBOT_URL = 'https://ftc-cmchatbot.firstinspires.org/'

export default function AIManual() {
  // Remounting the iframe is the only way to reset a conversation from out
  // here — the page keeps its own state and we cannot reach into it.
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <Bot size={18} className="text-pastel-blue-dark shrink-0" />
        <div className="min-w-0">
          <h2 className="font-bold text-gray-700 leading-tight">AI Manual</h2>
          <p className="text-xs text-gray-400 truncate">
            FIRST&apos;s Competition Manual chatbot — ask it a rules question
          </p>
        </div>
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            onClick={() => setReloadKey(k => k + 1)}
            title="Start over"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <a
            href={CHATBOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in a new tab"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pastel-blue hover:bg-pastel-blue-dark transition-colors text-xs font-semibold text-gray-700"
          >
            <ExternalLink size={13} /> Open
          </a>
        </div>
      </div>

      <iframe
        key={reloadKey}
        src={CHATBOT_URL}
        title="FTC Competition Manual chatbot"
        className="flex-1 w-full border-0 min-h-0"
        // It is someone else's page: let it run and talk to its own servers,
        // and nothing else.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
      />

      <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100 bg-white/80">
        Answers come from FIRST, not from us. Check the rule it quotes before
        you take it to a ref.
      </p>
    </div>
  )
}
