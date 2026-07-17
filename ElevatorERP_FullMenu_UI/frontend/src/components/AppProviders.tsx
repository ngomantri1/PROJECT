'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';

type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeStorageKey = 'elevator-erp:theme-mode';

export function useThemeMode() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemeMode must be used inside AppProviders');
  return value;
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(themeStorageKey);
    if (stored === 'dark' || stored === 'light') setModeState(stored);
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    window.localStorage.setItem(themeStorageKey, nextMode);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      setMode,
      toggleMode: () => setMode(mode === 'dark' ? 'light' : 'dark'),
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        locale={viVN}
        theme={{
          algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#008848',
            colorInfo: '#008848',
            colorSuccess: '#16a34a',
            colorWarning: '#f59e0b',
            colorError: '#ef4444',
            colorText: mode === 'dark' ? '#e5ede8' : '#17281e',
            colorTextSecondary: mode === 'dark' ? '#aab8b0' : '#66756b',
            colorBgLayout: mode === 'dark' ? '#0b1812' : '#f4f8f3',
            borderRadius: 10,
            borderRadiusLG: 14,
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          },
          components: {
            Button: { controlHeight: 38, borderRadius: 9, fontWeight: 600 },
            Card: { headerFontSize: 16, paddingLG: 20 },
            Table: {
              headerBg: mode === 'dark' ? '#12241b' : '#f7faf6',
              headerColor: mode === 'dark' ? '#d1ded6' : '#4d5f53',
            },
            Menu: { itemBorderRadius: 9, itemMarginInline: 10 },
            Input: { controlHeight: 38 },
            Select: { controlHeight: 38 },
          },
        }}
      >
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
