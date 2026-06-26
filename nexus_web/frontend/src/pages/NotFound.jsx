import { useTheme } from '../theme'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const C = useTheme()
  const navigate = useNavigate()
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      minHeight:'100vh',background:C.bg,color:C.text,flexDirection:'column',gap:20}}>
      <div style={{fontSize:120,fontWeight:900,color:C.blue,lineHeight:1,opacity:.3}}>404</div>
      <div style={{fontSize:22,fontWeight:700}}>Pagina no encontrada</div>
      <div style={{fontSize:14,color:C.muted}}>La pagina que buscas no existe o fue movida</div>
      <button onClick={()=>navigate('/')}
        style={{marginTop:10,padding:'10px 24px',borderRadius:10,border:'none',
          background:C.blue,color:'white',fontSize:14,fontWeight:700,cursor:'pointer'}}>
        Ir al Dashboard
      </button>
    </div>
  )
}
