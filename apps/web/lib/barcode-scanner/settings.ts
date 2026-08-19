export type BarcodeScannerSubmitKey = "enter" | "tab" | "none"

export type BarcodeScannerConnectorSettings = {
  enabled: boolean
  mode: "keyboard"
  submitKey: BarcodeScannerSubmitKey
  minLength: number
  autoSearch: boolean
  updatedAt: string | null
}

export const barcodeScannerSettingsStorageKey = "gstfy.barcode-scanner.settings.v1"

export const defaultBarcodeScannerSettings: BarcodeScannerConnectorSettings = {
  enabled: true,
  mode: "keyboard",
  submitKey: "enter",
  minLength: 8,
  autoSearch: true,
  updatedAt: null,
}

export const barcodeSubmitKeyOptions: Array<{
  value: BarcodeScannerSubmitKey
  label: string
}> = [
  { value: "enter", label: "Enter" },
  { value: "tab", label: "Tab" },
  { value: "none", label: "No suffix" },
]

export function readBarcodeScannerSettings(): BarcodeScannerConnectorSettings {
  if (typeof window === "undefined") {
    return defaultBarcodeScannerSettings
  }

  try {
    const savedSettings = window.localStorage.getItem(barcodeScannerSettingsStorageKey)

    if (!savedSettings) {
      return defaultBarcodeScannerSettings
    }

    const parsedSettings: unknown = JSON.parse(savedSettings)

    if (!isRecord(parsedSettings)) {
      return defaultBarcodeScannerSettings
    }

    return normalizeBarcodeScannerSettings({
      enabled:
        typeof parsedSettings.enabled === "boolean" ?
          parsedSettings.enabled
        : defaultBarcodeScannerSettings.enabled,
      mode: "keyboard",
      submitKey: isBarcodeSubmitKey(parsedSettings.submitKey) ?
        parsedSettings.submitKey
      : defaultBarcodeScannerSettings.submitKey,
      minLength:
        typeof parsedSettings.minLength === "number" ?
          parsedSettings.minLength
        : defaultBarcodeScannerSettings.minLength,
      autoSearch:
        typeof parsedSettings.autoSearch === "boolean" ?
          parsedSettings.autoSearch
        : defaultBarcodeScannerSettings.autoSearch,
      updatedAt:
        typeof parsedSettings.updatedAt === "string" ? parsedSettings.updatedAt : null,
    })
  } catch {
    return defaultBarcodeScannerSettings
  }
}

export function persistBarcodeScannerSettings(settings: BarcodeScannerConnectorSettings) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    barcodeScannerSettingsStorageKey,
    JSON.stringify(settings)
  )
}

export function normalizeBarcodeScannerSettings(
  settings: BarcodeScannerConnectorSettings
): BarcodeScannerConnectorSettings {
  return {
    ...settings,
    mode: "keyboard",
    minLength: Math.min(32, Math.max(4, Math.round(settings.minLength || 8))),
  }
}

export function isBarcodeSubmitKey(value: unknown): value is BarcodeScannerSubmitKey {
  return value === "enter" || value === "tab" || value === "none"
}

export function getBarcodeSubmitKeyLabel(value: BarcodeScannerSubmitKey) {
  return barcodeSubmitKeyOptions.find((option) => option.value === value)?.label ?? "Enter"
}

export function getBarcodeSubmitKeyFromKeyboardEventKey(
  key: string
): BarcodeScannerSubmitKey | null {
  if (key === "Enter") {
    return "enter"
  }

  if (key === "Tab") {
    return "tab"
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
