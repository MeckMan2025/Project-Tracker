// The board hands a job to a form.
//
// Tapping "Not scouted" on the Competition Day board should open the right
// form with that team (and match) already filled in. The board and the forms
// are different screens that never share state, so the job is left here on
// the way out and picked up by whichever form opens next. Taken once: a
// form that opens later, on its own, starts blank as it always did.
const KEY = 'scrum-scout-next'

export function requestScout(job) {
  try { localStorage.setItem(KEY, JSON.stringify(job)) } catch { /* no storage: the form just opens blank */ }
}

export function takeScoutRequest() {
  try {
    const v = localStorage.getItem(KEY)
    if (!v) return null
    localStorage.removeItem(KEY)
    return JSON.parse(v)
  } catch { return null }
}
