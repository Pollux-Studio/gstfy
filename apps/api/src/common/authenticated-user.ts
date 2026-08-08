export type AuthenticatedUser = {
  userId: string
  email: string | null
  phone: string | null
  role: string | null
  aal: string | null
}

export type AuthenticatedRequest = {
  user?: AuthenticatedUser
  headers: {
    authorization?: string
  }
}
