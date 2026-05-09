"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type ThemeMode = "light" | "dark"

type ThemeContextValue = {
  theme: ThemeMode
  resolvedTheme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const storageKey = "gstfy.theme"

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light"
  }

  const storedTheme = window.localStorage.getItem(storageKey)

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function ThemeProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    function applyTheme(nextTheme: ThemeMode) {
      document.documentElement.classList.toggle("dark", nextTheme === "dark")
      document.documentElement.style.colorScheme = nextTheme
      setResolvedTheme(nextTheme)
    }

    applyTheme(theme)

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const savedTheme = window.localStorage.getItem(storageKey)

      if (savedTheme === "dark" || savedTheme === "light") {
        return
      }

      const nextTheme: ThemeMode = event.matches ? "dark" : "light"
      applyTheme(nextTheme)
      setThemeState(nextTheme)
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange)
    }
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (nextTheme) => {
        window.localStorage.setItem(storageKey, nextTheme)
        document.documentElement.classList.toggle("dark", nextTheme === "dark")
        document.documentElement.style.colorScheme = nextTheme
        setThemeState(nextTheme)
        setResolvedTheme(nextTheme)
      },
    }),
    [resolvedTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
