// When a task was finished.
//
// A task can be marked done four different ways — dragged into the Done
// column, the Mark Done button on a card, the status control inside the task
// popup, and the one on the dashboard — so the stamp lives here rather than
// being written out four times and drifting.

// Both spellings exist in the data: the drag handler writes the column id,
// which is 'done', while the Mark Done button writes 'completed'.
const DONE = ['done', 'completed']

export function isDone(status) {
  return DONE.includes(String(status || '').toLowerCase())
}

// The fields to send when a task's status changes.
//
// Moving INTO done stamps the moment. Moving back OUT clears it, because a
// task that is open again has no completion date — leaving the old one would
// claim it was finished when it is sitting in Doing.
//
// Re-completing something re-stamps it. The question people ask is "when did
// this get done", and the answer is the time it was last finished, not the
// first time somebody ticked it.
export function completionFields(status) {
  return {
    status,
    completed_at: isDone(status) ? new Date().toISOString() : null,
  }
}
