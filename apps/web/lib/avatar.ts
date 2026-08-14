import { API_BASE_URL } from "@/lib/api/client"

export function getProfileAvatarUrl(seed: string | null | undefined) {
  if (!seed) {
    return ""
  }

  return `${API_BASE_URL}/api/avatars/profile/${encodeURIComponent(seed)}.svg`
}
