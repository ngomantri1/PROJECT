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
            colorText: mode === 'dark' ? '#f3f5f4' : '#17281e',
            colorTextSecondary: mode === 'dark' ? '#9da7a1' : '#66756b',
            colorBgLayout: mode === 'dark' ? '#0f1211' : '#f4f8f3',
            fontSize: 14,
            fontWeightStrong: 600,
            controlHeight: 32,
            borderRadius: 6,
            borderRadiusLG: 8,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
          },
          components: {
            Button: { controlHeight: 32, borderRadius: 6, fontWeight: 400 },
            Card: { headerFontSize: 16, paddingLG: 24 },
            Table: {
              headerBg: mode === 'dark' ? '#1b211e' : '#f7faf6',
              headerColor: mode === 'dark' ? '#dce4df' : '#4d5f53',
            },
            Menu: { itemBorderRadius: 6, itemMarginInline: 8 },
            Input: { controlHeight: 32 },
            Select: { controlHeight: 32 },
          },
        }}
      >
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
