import { useTheme } from '../theme'

export function SkeletonLine({ width = '100%', height = 14 }) {
  const C = useTheme()
  return <div className={C.mode === 'dark' ? 'skeleton' : 'skeleton-light'}
    style={{ width, height, marginBottom: 8 }} />
}

export function SkeletonCard() {
  return (
    <div style={{padding:20, borderRadius:12}}>
      <SkeletonLine width="60%" height={18} />
      <SkeletonLine width="40%" />
      <SkeletonLine width="80%" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {Array.from({length:rows}).map((_,i) => (
        <div key={i} style={{display:'flex',gap:12}}>
          {Array.from({length:cols}).map((_,j) => (
            <SkeletonLine key={j} width={`${100/cols}%`} height={16} />
          ))}
        </div>
      ))}
    </div>
  )
}
