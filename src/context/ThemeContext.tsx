import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ConfigProvider, theme as antdTheme } from "antd";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const isDark = themeMode === "dark";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    window.localStorage.setItem("theme", themeMode);
  }, [isDark, themeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      isDark,
      setThemeMode,
      toggleTheme: () =>
        setThemeMode((current) => (current === "dark" ? "light" : "dark")),
    }),
    [themeMode, isDark],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: isDark
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: "#4f46e5",
            colorSuccess: "#16a34a",
            colorWarning: "#d97706",
            colorError: "#dc2626",
            colorInfo: "#4f46e5",
            colorBgBase: isDark ? "#0f172a" : "#f8fafc",
            colorBgContainer: isDark ? "#111827" : "#ffffff",
            colorBgElevated: isDark ? "#111827" : "#ffffff",
            colorBorder: isDark ? "#334155" : "#dbe2f0",
            colorText: isDark ? "#e5eefb" : "#0f172a",
            colorTextSecondary: isDark ? "#94a3b8" : "#475569",
            colorTextTertiary: isDark ? "#64748b" : "#64748b",
            borderRadius: 16,
            fontFamily: '"Inter", sans-serif',
          },
          components: {
            Layout: {
              bodyBg: isDark ? "#0f172a" : "#f8fafc",
              headerBg: "transparent",
              footerBg: "transparent",
            },
            Card: {
              colorBgContainer: isDark ? "#111827" : "#ffffff",
            },
            Modal: {
              contentBg: isDark ? "#111827" : "#ffffff",
              headerBg: isDark ? "#111827" : "#ffffff",
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
