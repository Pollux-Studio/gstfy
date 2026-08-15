import { API_BASE_PATH, API_BASE_URL } from "@/lib/api/config"

export function getProfileAvatarUrl(seed: string | null | undefined) {
  if (!seed) {
    return ""
  }

  return `${API_BASE_URL}${API_BASE_PATH}/avatars/profile/${encodeURIComponent(seed)}.svg`
}
