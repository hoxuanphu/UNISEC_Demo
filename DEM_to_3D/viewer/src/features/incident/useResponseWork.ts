import { useEffect, useState } from 'react';
import { restoreWork, workEntry, type ResponseWork, type WorkStatus } from './responseWork';

export function useResponseWork(datasetVersion: string) {
  const key = `dear.response-work.v1:${datasetVersion}`;
  const read = () => {
    try {
      const value = localStorage.getItem(key) ?? '[]';
      if (value.length > 2_000_000) throw new Error('Work history limit');
      return { key, entries: restoreWork(JSON.parse(value)), error: false };
    } catch {
      return { key, entries: [], error: true };
    }
  };
  const [saved, setState] = useState(read);
  const state = saved.key === key ? saved : { key, entries: [], error: false };
  useEffect(() => {
    if (saved.key !== key) setState(read());
  }, [key, saved.key]);
  const record = (task: ResponseWork, status: WorkStatus, note: string, owner: string) => {
    const entry = workEntry(task, status, note, owner, new Date().toISOString());
    const entries = [...state.entries, entry].slice(-500);
    let error = false;
    try {
      localStorage.setItem(key, JSON.stringify(entries));
    } catch {
      error = true;
    }
    setState({ key, entries, error });
  };
  const reset = () => {
    try {
      localStorage.removeItem(key);
      setState({ key, entries: [], error: false });
    } catch {
      setState((previous) => ({ ...previous, error: true }));
    }
  };
  return { ...state, record, reset };
}
