import { configureStore } from "@reduxjs/toolkit"

import { languageReducer } from "@/lib/store/language-slice"

export function makeStore() {
  return configureStore({
    reducer: {
      language: languageReducer,
    },
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore["getState"]>
export type AppDispatch = AppStore["dispatch"]
