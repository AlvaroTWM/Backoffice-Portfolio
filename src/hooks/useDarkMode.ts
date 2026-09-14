import { useEffect, useState } from 'react'

const STORAGE_KEY = 'loyalty-theme'

export function useDarkMode() {
  // Initialize from the actual DOM state (set synchronously by index.html script)
  // so state and the 'dark' class on <html> are always in sync from the first render
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem(STORAGE_KEY, 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem(STORAGE_KEY, 'light')
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark((v) => !v) }
}
