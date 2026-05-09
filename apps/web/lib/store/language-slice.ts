import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import {
  isSupportedLanguage,
  languageStorageKey,
  type LanguageCode,
} from "@/lib/i18n/languages"

type LanguageState = {
  current: LanguageCode
}

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return "en"
  }

  const storedLanguage = window.localStorage.getItem(languageStorageKey)

  return isSupportedLanguage(storedLanguage) ? storedLanguage : "en"
}

const initialState: LanguageState = {
  current: getInitialLanguage(),
}

const languageSlice = createSlice({
  name: "language",
  initialState,
  reducers: {
    setLanguage(state, action: PayloadAction<LanguageCode>) {
      state.current = action.payload
    },
  },
})

export const { setLanguage } = languageSlice.actions
export const languageReducer = languageSlice.reducer
