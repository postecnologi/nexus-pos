import { createContext, useContext, useState, useEffect } from 'react'

const DARK = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151', bord3:'#4B5563',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B', red:'#EF4444',
  purple:'#8B5CF6', cyan:'#06B6D4',
  blueD:'rgba(59,130,246,.15)', greenD:'rgba(16,185,129,.15)',
  amberD:'rgba(245,158,11,.15)', redD:'rgba(239,68,68,.15)',
  purpleD:'rgba(139,92,246,.15)',
  blueGlow:'rgba(59,130,246,.35)',
  mode:'dark',
}

const LIGHT = {
  bg:'#F3F4F6', surface:'#FFFFFF', sur2:'#F9FAFB', sur3:'#E5E7EB',
  border:'#E5E7EB', bord2:'#D1D5DB', bord3:'#9CA3AF',
  text:'#111827', muted:'#4B5563', hint:'#6B7280',
  blue:'#2563EB', green:'#059669', amber:'#D97706', red:'#DC2626',
  purple:'#7C3AED', cyan:'#0891B2',
  blueD:'rgba(37,99,235,.1)', greenD:'rgba(5,150,105,.1)',
  amberD:'rgba(217,119,6,.1)', redD:'rgba(220,38,38,.1)',
  purpleD:'rgba(124,58,237,.1)',
  blueGlow:'rgba(37,99,235,.25)',
  mode:'light',
}

const ThemeContext = createContext({ theme: DARK, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('nexus_theme')
    return saved !== 'light'
  })

  useEffect(() => {
    localStorage.setItem('nexus_theme', isDark ? 'dark' : 'light')
    document.body.style.background = isDark ? DARK.bg : LIGHT.bg
    document.body.style.color = isDark ? DARK.text : LIGHT.text
  }, [isDark])

  const theme = isDark ? DARK : LIGHT
  const toggle = () => setIsDark(p => !p)

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const { theme } = useContext(ThemeContext)
  return theme
}

export function useThemeToggle() {
  const { toggle, isDark } = useContext(ThemeContext)
  return { toggle, isDark }
}
