import { createContext, useState } from 'react';

const prefix = 'viex-screen:';
export const ScreenPreferenceScope = createContext('');

export function readScreenPreference<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(prefix + key);
    return saved === null ? fallback : JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

export function writeScreenPreference<T>(key: string, value: T) {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch {}
}

export function useScreenPreference<T>(key: string, fallback: T) {
  const [current, setCurrent] = useState(() => ({ key, value: readScreenPreference(key, fallback) }));
  const value = current.key === key ? current.value : readScreenPreference(key, fallback);
  function update(next: T) {
    writeScreenPreference(key, next);
    setCurrent({ key, value: next });
  }
  return [value, update] as const;
}
