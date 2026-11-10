// "Your room": the customer's restyled window photo, saved on their phone (IndexedDB) so Try on can open it.
// Nothing here leaves the device. Shape: { blob, win:[x0,y0,x1,y1], glass?:[...], floor, label, saved }
// Coordinates are plate pixels in a 1536 × 1024 image, same as the stock rooms.
const DB = 'hello-shade', STORE = 'rooms', KEY = 'mine';

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function tx(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE), req = fn(s);
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  }));
}
export const saveMyRoom = room => tx('readwrite', s => s.put({ ...room, saved: Date.now() }, KEY));
export const clearMyRoom = () => tx('readwrite', s => s.delete(KEY));
export async function loadMyRoom() {
  try {
    const r = await tx('readonly', s => s.get(KEY));
    if (!r || !r.blob || !Array.isArray(r.win)) return null;
    return { id: 'mine', label: r.label || 'Your room', note: 'Your window, restyled.', floor: r.floor || 820,
      win: r.win, glass: r.glass, lamp: null, fixture: null, src: URL.createObjectURL(r.blob), saved: r.saved };
  } catch { return null; }
}
