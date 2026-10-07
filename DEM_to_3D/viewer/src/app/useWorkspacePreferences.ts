import { useEffect, useLayoutEffect, useState } from 'react';
import type { FontChoice, Locale } from '../types/dear';

export function useWorkspacePreferences() {
  const [locale, setLocale] = useState<Locale>('vi');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return window.localStorage.getItem('dear.theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  const [fontChoice, setFontChoice] = useState<FontChoice>(() => {
    try {
      const saved = window.localStorage.getItem('dear.font-choice');
      return saved === 'classic' || saved === 'plex' || saved === 'modern' ? saved : 'classic';
    } catch { return 'classic'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18211d' : '#f0f1ec');
    try { window.localStorage.setItem('dear.theme', theme); } catch { /* Session preference remains available. */ }
  }, [theme]);
  useLayoutEffect(() => {
    document.documentElement.dataset.font = fontChoice;
    try { window.localStorage.setItem('dear.font-choice', fontChoice); } catch { /* Session preference remains available. */ }
  }, [fontChoice]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'vi' ? 'DEAR | Bản đồ ứng phó' : 'DEAR | Response map';
  }, [locale]);
  return { locale, setLocale, theme, setTheme, fontChoice, setFontChoice };
}
