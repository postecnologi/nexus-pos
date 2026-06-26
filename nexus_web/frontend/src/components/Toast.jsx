import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  }

  const colors = {
    success: { bg: '#065F46', border: '#10B981', icon: '✅' },
    error: { bg: '#7F1D1D', border: '#EF4444', icon: '❌' },
    warning: { bg: '#78350F', border: '#F59E0B', icon: '⚠️' },
    info: { bg: '#1E3A5F', border: '#3B82F6', icon: 'ℹ️' },
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div style={{position:'fixed', top:20, right:20, zIndex:99999, display:'flex', flexDirection:'column', gap:8, maxWidth:400}}>
        {toasts.map(t => {
          const c = colors[t.type]
          return (
            <div key={t.id} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 12, padding: '12px 16px',
              color: 'white', fontSize: 13, fontWeight: 500,
              boxShadow: '0 8px 30px rgba(0,0,0,.4)',
              display: 'flex', alignItems: 'center', gap: 10,
              animation: 'slideInRight 0.3s ease-out',
              backdropFilter: 'blur(10px)',
            }}>
              <span style={{fontSize:16}}>{c.icon}</span>
              <span style={{flex:1}}>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer',fontSize:16,padding:0}}>
                &times;
              </button>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
