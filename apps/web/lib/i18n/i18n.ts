import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { resources } from "@/lib/i18n/resources"

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })
} else {
  const resourceStore = i18n.services.resourceStore as unknown as {
    addResourceBundle: (
      language: string,
      namespace: string,
      resource: unknown,
      deep: boolean,
      overwrite: boolean
    ) => void
  }

  for (const [language, bundle] of Object.entries(resources)) {
    resourceStore.addResourceBundle(
      language,
      "translation",
      bundle.translation,
      true,
      true
    )
  }
}

export { i18n }
