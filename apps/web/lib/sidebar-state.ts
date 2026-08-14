export const sidebarCookieName = "sidebar_state"
export const sidebarStorageKey = "gstfy.sidebar.open"

const sidebarCookieMaxAge = 60 * 60 * 24 * 7

export function getStoredSidebarOpen(defaultOpen: boolean) {
  if (typeof window === "undefined") {
    return defaultOpen
  }

  const storedValue = window.localStorage.getItem(sidebarStorageKey)

  if (storedValue === "true") {
    return true
  }

  if (storedValue === "false") {
    return false
  }

  return defaultOpen
}

export function persistSidebarOpen(open: boolean) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(sidebarStorageKey, String(open))
  document.cookie = `${sidebarCookieName}=${open}; path=/; max-age=${sidebarCookieMaxAge}`
}
