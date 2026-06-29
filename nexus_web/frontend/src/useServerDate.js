import { useState, useEffect } from 'react'
import api from './api'

let cachedDate = null
let cacheTime = 0
const CACHE_MS = 5 * 60 * 1000

export function useServerDate() {
  const [serverDate, setServerDate] = useState(cachedDate)

  useEffect(() => {
    if (cachedDate && Date.now() - cacheTime < CACHE_MS) {
      setServerDate(cachedDate)
      return
    }
    api.get('/server-time')
      .then(r => {
        cachedDate = r.data
        cacheTime = Date.now()
        setServerDate(r.data)
      })
      .catch(() => {
        const now = new Date()
        const fallback = {
          date: now.toISOString().slice(0, 10),
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
        }
        setServerDate(fallback)
      })
  }, [])

  return serverDate
}

export function getServerDate() {
  if (cachedDate && Date.now() - cacheTime < CACHE_MS) return cachedDate.date
  return new Date().toISOString().slice(0, 10)
}

export function getServerYear() {
  if (cachedDate && Date.now() - cacheTime < CACHE_MS) return cachedDate.year
  return new Date().getFullYear()
}

export function getServerMonth() {
  if (cachedDate && Date.now() - cacheTime < CACHE_MS) {
    return `${cachedDate.year}-${String(cachedDate.month).padStart(2, '0')}`
  }
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function fetchServerDate() {
  try {
    const r = await api.get('/server-time')
    cachedDate = r.data
    cacheTime = Date.now()
    return r.data
  } catch {
    return null
  }
}
