const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4100'

export async function getStatusOverview() {
  const res = await fetch(`${API_BASE_URL}/api/v1/status`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch status overview')
  return res.json()
}

export async function getServices() {
  const res = await fetch(`${API_BASE_URL}/api/v1/services`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch services')
  return res.json()
}

export async function getIncidents() {
  const res = await fetch(`${API_BASE_URL}/api/v1/incidents?limit=10`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch incidents')
  return res.json()
}

export async function getMaintenance() {
  const res = await fetch(`${API_BASE_URL}/api/v1/maintenance?limit=5`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch maintenance')
  return res.json()
}
