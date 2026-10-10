// Data layer for the SWOT feature. SwotView only talks to the database through
// these exports, so swapping the local dev backend (local-db/plugin.js) for
// Supabase at merge time only requires reimplementing this file.

const request = async (method, path, body) => {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

// Calls onState with the full { swot, activeSection, suggestions } state now
// and after every change. Returns an unsubscribe function.
export const subscribe = (onState) => {
  const source = new EventSource('/api/events');
  source.onmessage = (event) => onState(JSON.parse(event.data));
  return () => source.close();
};

// section is a category key, or null to unlock every section.
export const setActiveSection = (section) => request('PUT', '/active-section', { section });

export const addItem = (category, text) => request('POST', `/swot/${category}`, { text });

export const removeItem = (category, index) => request('DELETE', `/swot/${category}/${index}`);

export const addSuggestion = (section, text, author) => request('POST', '/suggestions', { section, text, author });

export const approveSuggestion = (id) => request('POST', `/suggestions/${id}/approve`);

export const rejectSuggestion = (id) => request('DELETE', `/suggestions/${id}`);
