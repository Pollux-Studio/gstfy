export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://api.localhost:4000"
).replace(/\/$/, "")

export const API_BASE_PATH = "/api/v1"
