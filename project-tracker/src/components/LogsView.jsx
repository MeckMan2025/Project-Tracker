import { ScrollText } from 'lucide-react'

// A placeholder on purpose. The tab exists so it can be found and linked to;
// what belongs in it hasn't been decided yet. Nothing in the app records an
// activity trail today, so there is no data to show here until something starts
// writing one — which is why this says so plainly instead of faking an empty
// table and looking broken.
export default function LogsView() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-1">Logs</h1>
      <p className="text-sm text-gray-500 mb-6">A record of what happens on the team.</p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <ScrollText size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Nothing here yet.</p>
        <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
          This tab is set up and ready — it just needs to be told what to keep
          track of.
        </p>
      </div>
    </div>
  )
}
