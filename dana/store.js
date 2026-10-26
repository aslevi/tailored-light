// All lead persistence goes through here. Today: this browser's localStorage.
// Later: swap the bodies for Supabase calls; the async API and the lead shape stay the same.
const KEY = 'tl-dana-leads-v1';
const META = 'tl-dana-meta-v1';
let memory = { v: 1, leads: [] }; // fallback when storage is blocked (private mode)
let persistent = true;

function load() {
  try { const s = localStorage.getItem(KEY); if (s) memory = JSON.parse(s); if (!Array.isArray(memory.leads)) memory = { v: 1, leads: [] }; }
  catch { persistent = false; }
  return memory;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); persistent = true; }
  catch { persistent = false; }
}
const clone = o => JSON.parse(JSON.stringify(o));

export const isPersistent = () => { load(); return persistent; };

export async function list() { return clone(load().leads); }
export async function get(id) { const l = load().leads.find(x => x.id === id); return l ? clone(l) : null; }
export async function upsert(lead) {
  load();
  const l = clone({ ...lead, updatedAt: new Date().toISOString() });
  const i = memory.leads.findIndex(x => x.id === l.id);
  if (i >= 0) memory.leads[i] = l; else memory.leads.push(l);
  save();
  return clone(l);
}
export async function remove(id) { load(); memory.leads = memory.leads.filter(x => x.id !== id); save(); }

export async function exportAll() {
  load();
  setMeta({ lastExport: new Date().toISOString() });
  return { app: 'tailored-light-dana', v: 1, exportedAt: new Date().toISOString(), leads: clone(memory.leads) };
}
// mode 'merge': add new leads, replace a lead only if the imported copy is newer. 'replace': wipe and load.
export async function importAll(data, mode = 'merge') {
  const leads = Array.isArray(data) ? data : data && Array.isArray(data.leads) ? data.leads : null;
  if (!leads || leads.some(l => !l || typeof l.id !== 'string')) throw new Error('Not a Tailored Light leads backup.');
  load();
  let added = 0, updated = 0;
  if (mode === 'replace') { memory.leads = clone(leads); added = leads.length; }
  else for (const l of leads) {
    const i = memory.leads.findIndex(x => x.id === l.id);
    if (i < 0) { memory.leads.push(clone(l)); added++; }
    else if (new Date(l.updatedAt || 0) > new Date(memory.leads[i].updatedAt || 0)) { memory.leads[i] = clone(l); updated++; }
  }
  save();
  return { added, updated, total: memory.leads.length };
}

export function getMeta() { try { return JSON.parse(localStorage.getItem(META) || '{}'); } catch { return {}; } }
export function setMeta(patch) { try { localStorage.setItem(META, JSON.stringify({ ...getMeta(), ...patch })); } catch {} }
