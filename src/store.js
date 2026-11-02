// localStorage behind try/catch: private mode or blocked site data falls back to defaults.
const PREFIX = 'cebar-mate:';

export function createStore(storage) {
  const backend = () => {
    if (storage) return storage;
    try { return globalThis.localStorage || null; } catch { return null; }
  };
  return {
    get(key, fallback) {
      try {
        const raw = backend()?.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { backend()?.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };
}
