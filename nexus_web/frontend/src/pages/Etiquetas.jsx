// ============================================================
//  NEXUS POS — Editor de Etiquetas de Precio
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
const API_HOST = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '')
import api from '../api'
import { useTheme } from '../theme'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B',
  red:'#EF4444', purple:'#8B5CF6', cyan:'#06B6D4',
  greenD:'rgba(16,185,129,.15)', amberD:'rgba(245,158,11,.15)',
  redD:'rgba(239,68,68,.15)', blueD:'rgba(59,130,246,.15)',
}
const FI = {
  padding:'7px 10px', borderRadius:7, fontSize:12,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%'
}

// 1mm = 3.7795px a 96dpi
const MM = 3.7795
const mm2px = mm => Math.round(mm * MM)

const TAMANHOS = [
  {id:'58x40',  l:'58 × 40 mm',   wMm:58,  hMm:40,  desc:'Etiqueta pequeña'},
  {id:'80x50',  l:'80 × 50 mm',   wMm:80,  hMm:50,  desc:'Etiqueta mediana'},
  {id:'100x70', l:'100 × 70 mm',  wMm:100, hMm:70,  desc:'Etiqueta grande'},
  {id:'50x25',  l:'50 × 25 mm',   wMm:50,  hMm:25,  desc:'Precio pequeño'},
  {id:'90x55',  l:'90 × 55 mm',   wMm:90,  hMm:55,  desc:'Tarjeta estándar'},
  {id:'105x74', l:'105 × 74 mm',  wMm:105, hMm:74,  desc:'A7'},
  {id:'custom', l:'Personalizado', wMm:80,  hMm:50,  desc:'Definir en mm'},
].map(t=>({...t, w:mm2px(t.wMm), h:mm2px(t.hMm)}))

// Variables agrupadas por categoría
const VARIABLES = [
  // Producto
  {g:'Producto', v:'{{descripcion}}',        l:'Descripción',          e:'📝'},
  {g:'Producto', v:'{{codigo}}',             l:'Código',               e:'🔢'},
  {g:'Producto', v:'{{marca}}',              l:'Marca',                e:'🏷'},
  {g:'Producto', v:'{{categoria}}',          l:'Categoría',            e:'📂'},
  {g:'Producto', v:'{{codigo_barras}}',      l:'Código de barras',     e:'▌▌▌'},
  // Precios normales
  {g:'Precios',  v:'{{precio}}',             l:'Precio (lista selec.)',  e:'💲'},
  {g:'Precios',  v:'{{precio_1}}',           l:'Precio 1 (siempre)',    e:'1️⃣'},
  {g:'Precios',  v:'{{precio_2}}',           l:'Precio 2 (siempre)',    e:'2️⃣'},
  {g:'Precios',  v:'{{precio_3}}',           l:'Precio 3 (siempre)',    e:'3️⃣'},
  {g:'Precios',  v:'{{precio_mayor}}',       l:'Precio mayorista',      e:'💰'},
  // Oferta
  {g:'Oferta',   v:'{{precio_oferta}}',      l:'Precio oferta (c/IVA)', e:'🏷'},
  {g:'Oferta',   v:'{{precio_original}}',    l:'Precio original (tachado)',e:'❌'},
  {g:'Oferta',   v:'{{descuento_pct}}',      l:'% de descuento',        e:'%'},
  {g:'Oferta',   v:'{{fecha_fin_oferta}}',   l:'Válido hasta',          e:'📅'},
  {g:'Oferta',   v:'{{fecha_ini_oferta}}',   l:'Inicio oferta',         e:'🗓'},
  {g:'Oferta',   v:'{{desc_oferta}}',        l:'Descripción oferta',    e:'✨'},
]

// Plantilla vacía de inicio
const PLANTILLA_VACIA = {
  id:'nueva', elementos:[]
}

// Fuentes disponibles
const FUENTES = [
  {v:'sans-serif',                       l:'Sans (default)'},
  {v:'Arial, sans-serif',                l:'Arial'},
  {v:'"Helvetica Neue",sans-serif',      l:'Helvetica'},
  {v:'"Times New Roman",serif',          l:'Times New Roman'},
  {v:'Georgia,serif',                    l:'Georgia'},
  {v:'"Courier New",monospace',          l:'Courier (código)'},
  {v:'Impact,sans-serif',                l:'Impact'},
  {v:'"Trebuchet MS",sans-serif',        l:'Trebuchet'},
  {v:'Verdana,sans-serif',               l:'Verdana'},
  {v:'"Comic Sans MS",cursive',          l:'Comic Sans'},
  {v:'Roboto,sans-serif',                l:'Roboto'},
  {v:'"Open Sans",sans-serif',           l:'Open Sans'},
  {v:'Montserrat,sans-serif',            l:'Montserrat'},
  {v:'Oswald,sans-serif',                l:'Oswald'},
  {v:'Raleway,sans-serif',               l:'Raleway'},
  {v:'"Playfair Display",serif',         l:'Playfair Display'},
  {v:'"Bebas Neue",cursive',             l:'Bebas Neue'},
  {v:'Anton,sans-serif',                 l:'Anton (impacto)'},
  {v:'Pacifico,cursive',                 l:'Pacifico (cursiva)'},
  {v:'"Black Han Sans",sans-serif',      l:'Black Han Sans'},
  {v:'"DSEG7 Classic",monospace',         l:'🔢 LCD 7-seg clásico'},
  {v:'"DSEG7 Modern",monospace',          l:'🔢 LCD 7-seg moderno'},
  {v:'"DSEG14 Classic",monospace',        l:'🔢 LCD 14-seg clásico'},
  {v:'Orbitron,sans-serif',               l:'🚀 Orbitron (digital)'},
  {v:'"Share Tech Mono",monospace',       l:'💻 Share Tech Mono'},
  {v:'"Share Tech Mono",monospace',       l:'Tech Mono'},
  {v:'"Orbitron",sans-serif',             l:'Orbitron (sci-fi)'},
  {v:'"Rajdhani",sans-serif',             l:'Rajdhani'},
  {v:'"Exo 2",sans-serif',               l:'Exo 2'},
]

// ── Resolver variables con datos del producto ────────────────
function resolverVars(texto, producto, tipoPrecioId) {
  if(!producto||!texto) return texto||''
  const precios  = producto.precios||[]
  const iva      = Number(producto.iva_porcentaje||0)
  const pvp      = b => parseFloat((b*(1+iva/100)).toFixed(2))

  // Precio base por lista seleccionada → convertir a PVP
  let precioBase = 0
  if(tipoPrecioId && precios.length) {
    const obj = precios.find(p=>String(p.tipo_precio_id)===String(tipoPrecioId))
    precioBase = obj ? Number(obj.precio) : Number(precios[0]?.precio||0)
  } else {
    precioBase = Number(precios[0]?.precio||0) || Number(producto.precio_venta||0)
  }
  const precio = pvp(precioBase)

  const precioMayor = precios.length>1 ? pvp(Number(precios[1].precio)) : precio
  // Precios en PVP — usar precio_pvp precalculado si viene del backend
  const p1 = Number(precios[0]?.precio_pvp||pvp(Number(precios[0]?.precio||0)))
  const p2 = Number(precios[1]?.precio_pvp||pvp(Number(precios[1]?.precio||0)))
  const p3 = Number(precios[2]?.precio_pvp||pvp(Number(precios[2]?.precio||0)))

  // Oferta
  const precioOferta   = Number(producto.precio_oferta||producto.precio_oferta_pvp||0)
  const precioOrigPvp  = pvp(Number(precios[0]?.precio||0))
  const descPct = precioOrigPvp>0&&precioOferta>0
    ? Math.round((1-precioOferta/precioOrigPvp)*100) : 0
  const fmtFecha = f => {
    if(!f) return ''
    try {
      const d = new Date(f+'T12:00')
      return d.toLocaleDateString('es-EC',{day:'2-digit',month:'2-digit',year:'numeric'})
    } catch { return String(f) }
  }

  return texto
    .replace(/\{\{descripcion\}\}/g,       String(producto.descripcion||''))
    .replace(/\{\{codigo\}\}/g,             String(producto.codigo||''))
    .replace(/\{\{precio_1\}\}/g,           '$'+p1.toFixed(2))
    .replace(/\{\{precio_2\}\}/g,           '$'+p2.toFixed(2))
    .replace(/\{\{precio_3\}\}/g,           '$'+p3.toFixed(2))
    .replace(/\{\{precio\}\}/g,             '$'+precio.toFixed(2))
    .replace(/\{\{precio_mayor\}\}/g,       '$'+precioMayor.toFixed(2))
    .replace(/\{\{precio_oferta\}\}/g,      precioOferta>0 ? '$'+precioOferta.toFixed(2) : '')
    .replace(/\{\{precio_original\}\}/g,    '$'+precioOrigPvp.toFixed(2))
    .replace(/\{\{descuento_pct\}\}/g,      descPct>0 ? '-'+descPct+'%' : '')
    .replace(/\{\{fecha_fin_oferta\}\}/g,   fmtFecha(producto.fecha_fin||producto.fecha_fin_oferta||''))
    .replace(/\{\{fecha_ini_oferta\}\}/g,   fmtFecha(producto.fecha_inicio||producto.fecha_ini_oferta||''))
    .replace(/\{\{desc_oferta\}\}/g,        String(producto.descripcion_oferta||producto.desc_oferta||''))
    .replace(/\{\{marca\}\}/g,              String(producto.marca_nombre||''))
    .replace(/\{\{categoria\}\}/g,          String(producto.categoria_nombre||''))
    .replace(/\{\{codigo_barras\}\}/g,      String(producto.codigo_barras||producto.codigo||''))
}


// ── Code128 — generador de barras nativo ─────────────────────
// Genera SVG de código de barras Code128 sin librerías externas
function makeBarcode(text) {
  if(!text) return ''
  // Code128-B: soporta ASCII 32-127 (letras, números, símbolos)
  const PATTERNS = {
    ' ':11011001100,'!':11001101100,'"':11001100110,'#':10010011000,
    '$':10010001100,'%':10001001100,'&':10011001000,"'":10011000100,
    '(':10001100100,')':11001001000,'*':11001000100,'+':11000100100,
    ',':10110011100,'-':10011011100,'.':10011001110,'/':10111001100,
    '0':10011101100,'1':11001110010,'2':11001011100,'3':11010001100,
    '4':11000101100,'5':11000100110,'6':10001011000,'7':10001000110,
    '8':10110001000,'9':10001101000,':':10001100010,';':11010011100,
    '<':11010001110,'=':11010111000,'>':11010100110,'?':10001110110,
    '@':10100110100,'A':10100011010,'B':10001011010,'C':10100111000,
    'D':10100010110,'E':10001010110,'F':10111000100,'G':10001110100,
    'H':10101110000,'I':10001011110,'J':10100011110,'K':10010111100,
    'L':10101100110,'M':10100110010,'N':11010001010,'O':11000101010,
    'P':10110100100,'Q':10110010100,'R':10110001010,'S':10001101010,
    'T':10001001010,'U':10010001010,'V':10001001110,'W':11000100010,
    'X':10111011110,'Y':10111101110,'Z':11110101110,
    '[':11000010100,'\\':10001111010,']':10100001100,'^':10011110100,
    '_':10011110010,'`':11110100100,'a':11000110100,'b':11101100100,
    'c':11100110100,'d':11101101100,'e':11100101100,'f':11100100110,
    'g':11101001100,'h':11100101110,'i':11011110110,'j':11011011110,
    'k':11110110110,'l':10100101110,'m':10100111110,'n':10111101100,
    'o':10111100110,'p':10100110110,'q':10110110100,'r':10110111100,
    's':10111011100,'t':10001101110,'u':10011110110,'v':10100111100,
    'w':10111100100,'x':10011010010,'y':11010011010,'z':11010100100,
    '{':11001010110,'|':11010110100,'}':11010010110,'~':11000010110,
  }
  const START_B = 11010010000
  const STOP    = 1100011101011
  const CODE_B_VAL = 104

  function patternBits(num) {
    return String(num).split('').map(Number)
  }

  let checksum = CODE_B_VAL
  let bars = [...patternBits(START_B)]

  for(let i=0; i<text.length; i++) {
    const ch = text[i]
    const pat = PATTERNS[ch]
    if(pat===undefined) continue
    const val = Object.keys(PATTERNS).indexOf(ch)
    checksum += (i+1) * val
    bars.push(...patternBits(pat))
  }

  // checksum mod 103
  const chkVal = checksum % 103
  const chkKeys = Object.keys(PATTERNS)
  if(chkVal < chkKeys.length) {
    bars.push(...patternBits(PATTERNS[chkKeys[chkVal]]||PATTERNS[' ']))
  }
  bars.push(...patternBits(STOP))

  return bars
}

function BarcodeCanvas({text, width=200, height=40, color='#000000'}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const safeText = (text||'').replace(/[^\x20-\x7E]/g,'?') || 'BARCODE'
  const bars = makeBarcode(safeText)
  if(!bars||!bars.length) return(
    <div style={{width,height,display:'flex',alignItems:'center',
      justifyContent:'center',fontSize:9,color:'#9CA3AF',
      border:'1px dashed #374151',borderRadius:3,background:'white'}}>
      ▌▌▌ {safeText} ▌▌▌
    </div>
  )
  // SVG puro — render inmediato, sin useEffect
  const barW = width / bars.length
  const rects = []
  let i=0
  while(i<bars.length) {
    if(bars[i]) {
      let j=i
      while(j<bars.length && bars[j]) j++
      rects.push(
        <rect key={i}
          x={i*barW} y={0}
          width={(j-i)*barW} height={height}
          fill={color}/>
      )
      i=j
    } else { i++ }
  }
  return(
    <svg width={width} height={height}
      style={{display:'block',shapeRendering:'crispEdges'}}
      viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill="white"/>
      {rects}
    </svg>
  )
}

// ── Canvas interactivo con drag / resize / rotate ───────────
function CanvasEditor({plantilla, setPlantilla, tamano, producto, bgColor, tipoPrecioSel, onSelChange}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [sel,    setSel]    = useState(null)
  const [action, setAction] = useState(null)
  const [snapLines, setSnapLines] = useState([]) // guías visuales
  const canvasRef = useRef()
  const W = tamano.w
  const H = tamano.h

  function getEl(id) { return plantilla.elementos?.find(e=>e.id===id) }
  function updEl(id, patch) {
    setPlantilla(p=>({...p, elementos:p.elementos.map(e=>e.id===id?{...e,...patch}:e)}))
  }

  function onMouseDown(e, id, type) {
    e.stopPropagation()
    setSel(id)
    onSelChange&&onSelChange(String(id))
    const el = getEl(id); if(!el) return
    const rot = (el.rot||0) * Math.PI / 180
    setAction({ type, id,
      startX:e.clientX, startY:e.clientY,
      origX:el.x, origY:el.y, origW:el.w, origH:el.h, origRot:el.rot||0,
      cx:el.x+el.w/2, cy:el.y+el.h/2, rot,
    })
  }

  useEffect(()=>{
    function onMove(e) {
      if(!action) return
      const el = getEl(action.id); if(!el) return
      const rawDx = e.clientX - action.startX
      const rawDy = e.clientY - action.startY
      const rot   = action.rot||0
      // Delta proyectado al espacio local del elemento
      const ldx =  rawDx*Math.cos(rot) + rawDy*Math.sin(rot)
      const ldy = -rawDx*Math.sin(rot) + rawDy*Math.cos(rot)

      if(action.type==='move') {
        // Permitir mover libremente — sin límites duros
        updEl(action.id, {
          x: action.origX + rawDx,
          y: action.origY + rawDy,
        })
      }
      // Esquinas
      if(action.type==='resize-br') updEl(action.id, {w:Math.max(20,action.origW+ldx), h:Math.max(10,action.origH+ldy)})
      if(action.type==='resize-tr') updEl(action.id, {w:Math.max(20,action.origW+ldx), h:Math.max(10,action.origH-ldy), y:action.origY+rawDy})
      if(action.type==='resize-bl') {
        const nw=Math.max(20,action.origW-ldx)
        updEl(action.id, {x:action.origX+(action.origW-nw)*Math.cos(rot), y:action.origY+(action.origW-nw)*Math.sin(rot), w:nw, h:Math.max(10,action.origH+ldy)})
      }
      if(action.type==='resize-tl') {
        const nw=Math.max(20,action.origW-ldx), nh=Math.max(10,action.origH-ldy)
        updEl(action.id, {x:action.origX+rawDx, y:action.origY+rawDy, w:nw, h:nh})
      }
      // Lados — estirar solo un eje, compensando rotación
      if(action.type==='resize-r') updEl(action.id, {w:Math.max(20,action.origW+ldx)})
      if(action.type==='resize-b') updEl(action.id, {h:Math.max(10,action.origH+ldy)})
      if(action.type==='resize-l') {
        const nw=Math.max(20,action.origW-ldx)
        updEl(action.id, {x:action.origX+(action.origW-nw)*Math.cos(rot), y:action.origY+(action.origW-nw)*Math.sin(rot), w:nw})
      }
      if(action.type==='resize-t') {
        const nh=Math.max(10,action.origH-ldy)
        updEl(action.id, {x:action.origX-(action.origH-nh)*Math.sin(rot), y:action.origY+(action.origH-nh)*Math.cos(rot), h:nh})
      }
      // Rotar
      if(action.type==='rotate') {
        const rect=canvasRef.current.getBoundingClientRect()
        const cx=rect.left+action.cx, cy=rect.top+action.cy
        const angle=Math.atan2(e.clientY-cy, e.clientX-cx)*180/Math.PI+90
        updEl(action.id, {rot:Math.round(angle)})
      }
      // Calcular guías de snap durante el movimiento
      if(action.type==='move') {
        const el2 = getEl(action.id)
        if(el2) {
          const SNAP=6, lines=[]
          if(Math.abs(el2.x)<SNAP||Math.abs(el2.x+el2.w-W)<SNAP) lines.push({axis:'v',pos:el2.x<W/2?0:W,type:'edge'})
          if(Math.abs(el2.y)<SNAP||Math.abs(el2.y+el2.h-H)<SNAP) lines.push({axis:'h',pos:el2.y<H/2?0:H,type:'edge'})
          if(Math.abs(el2.x+el2.w/2-W/2)<SNAP) lines.push({axis:'v',pos:W/2,type:'center'})
          if(Math.abs(el2.y+el2.h/2-H/2)<SNAP) lines.push({axis:'h',pos:H/2,type:'center'})
          setSnapLines(lines)
        }
      } else { setSnapLines([]) }
    }
    function onUp() {
      if(action) {
        const el = getEl(action.id)
        if(el && action.type==='move') {
          // Snap suave a bordes si está a menos de 6px
          const SNAP = 6
          let nx=el.x, ny=el.y
          if(Math.abs(el.x) < SNAP)           nx=0
          if(Math.abs(el.y) < SNAP)           ny=0
          if(Math.abs(el.x+el.w-W) < SNAP)   nx=W-el.w
          if(Math.abs(el.y+el.h-H) < SNAP)   ny=H-el.h
          if(Math.abs(el.x+el.w/2-W/2) < SNAP) nx=W/2-el.w/2
          if(Math.abs(el.y+el.h/2-H/2) < SNAP) ny=H/2-el.h/2
          if(nx!==el.x||ny!==el.y) updEl(action.id,{x:Math.round(nx),y:Math.round(ny)})
        }
      }
      setSnapLines([])
      setAction(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
  },[action, plantilla])

  function Handle({type, style}) {
    const isSide   = ['resize-r','resize-l','resize-t','resize-b'].includes(type)
    const isRotate = type==='rotate'
    const cursorMap = {
      'resize-tl':'nwse-resize','resize-br':'nwse-resize',
      'resize-tr':'nesw-resize','resize-bl':'nesw-resize',
      'resize-r':'ew-resize',  'resize-l':'ew-resize',
      'resize-t':'ns-resize',  'resize-b':'ns-resize',
      'rotate':'crosshair',
    }
    return(
      <div
        onMouseDown={e=>{ e.stopPropagation(); onMouseDown(e, sel, type) }}
        style={{
          position:'absolute',
          width:  isSide?8:9,
          height: isSide?8:9,
          background: isRotate?'#f59e0b': isSide?'#10b981':'#3b82f6',
          border:'2px solid white',
          borderRadius: (isRotate||isSide)?'50%':2,
          cursor: cursorMap[type]||'default',
          zIndex:200,
          transform:'translate(-50%,-50%)',
          boxShadow:'0 1px 4px rgba(0,0,0,.6)',
          pointerEvents:'all',
          ...style,
        }}
      />
    )
  }

  return(
    <div style={{position:'relative', flexShrink:0}}>
      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={e=>{if(e.target===canvasRef.current){setSel(null);onSelChange&&onSelChange(null)}}}
        style={{
          width:W, height:H,
          background:bgColor,
          position:'relative',
          borderRadius:4,
          border: sel ? '1.5px solid #3b82f6' : '1.5px solid #4B5563',
          cursor:'default',
          userSelect:'none',
          flexShrink:0,
          overflow:'visible',
          isolation:'isolate',
        }}>

        {/* Guías de snap */}
        {snapLines.map((g,i)=>(
          <div key={i} style={{
            position:'absolute', zIndex:999, pointerEvents:'none',
            background: g.type==='center'?'rgba(59,130,246,.6)':'rgba(16,185,129,.6)',
            ...(g.axis==='v'
              ? {left:g.pos, top:0, width:1, height:H}
              : {left:0, top:g.pos, width:W, height:1}
            ),
          }}/>
        ))}

        {plantilla.elementos?.map((el,idx)=>{
          const isSel   = sel===el.id
          const esFondo = idx===0 && !isSel && plantilla.elementos.length>1
          const rot     = el.rot||0
          const baseStyle = {
            position:'absolute',
            left: el.x, top: el.y,
            width: el.w, height: el.h,
            transform: `rotate(${rot}deg)`,
            transformOrigin:'center center',
            cursor: isSel?'move': esFondo?'default':'pointer',
            boxShadow: isSel?`0 0 0 2px #3b82f6, 0 0 0 4px rgba(59,130,246,.2)`:'none',
            zIndex: isSel?100:(idx+1),
            overflow: (el.tipo==='imagen'||el.tipo==='rect') ? 'hidden' : 'visible',
            // Si es el fondo y no está seleccionado, no captura clics para que los de arriba sean clicables
            pointerEvents: esFondo ? 'none' : 'auto',
          }

          let inner = null
          if(el.tipo==='rect') {
            inner = <div style={{
              width:'100%',height:'100%',
              background: el.sinFondo ? 'transparent' : (el.color||'#000'),
              border: el.borderColor ? `${el.borderWidth||2}px solid ${el.borderColor}` : 'none',
              borderRadius: el.borderRadius ? `${el.borderRadius}px` : 0,
              boxSizing:'border-box',
            }}/>
          } else if(el.tipo==='imagen') {
            inner = el.src
              ? <img src={el.src} style={{
                  position:'absolute',inset:0,
                  width:'100%',height:'100%',objectFit:'fill',display:'block',
                  zIndex:0,
                }} draggable={false}/>
              : <div style={{
                  position:'absolute',inset:0,
                  background:'#374151',display:'flex',
                  alignItems:'center',justifyContent:'center',fontSize:11,color:'#9CA3AF',
                }}>
                  🖼 Imagen
                </div>
          } else if(el.tipo==='texto'||el.tipo==='precio') {
            inner = (
              <div style={{
                width:'100%',height:'100%',
                fontSize: el.fontSize||12,
                fontWeight: el.bold?'bold':'normal',
                fontStyle: el.italic?'italic':'normal',
                textDecoration: el.tachado?'line-through':'none',
                color: el.color||'#000',
                textAlign: el.align||'left',
                fontFamily: el.fontFamily||'inherit',
                display:'flex', alignItems:'center',
                justifyContent: el.align==='center'?'center': el.align==='right'?'flex-end':'flex-start',
                padding:'0 2px', lineHeight:1.2,
                whiteSpace:'pre-wrap', wordBreak:'break-word',
                overflow:'hidden',
              }}>
                {resolverVars(el.texto, producto, tipoPrecioSel)}
              </div>
            )
          }

          return(
            <div key={el.id} style={baseStyle}
              onMouseDown={e=>onMouseDown(e, el.id, 'move')}>
              {inner}
              {isSel&&<>
                {/* Esquinas — azul */}
                <Handle type="resize-tl" style={{left:0,      top:0}}/>
                <Handle type="resize-tr" style={{left:'100%', top:0}}/>
                <Handle type="resize-bl" style={{left:0,      top:'100%'}}/>
                <Handle type="resize-br" style={{left:'100%', top:'100%'}}/>
                {/* Lados — verde */}
                <Handle type="resize-t"  style={{left:'50%',  top:0}}/>
                <Handle type="resize-b"  style={{left:'50%',  top:'100%'}}/>
                <Handle type="resize-l"  style={{left:0,      top:'50%'}}/>
                <Handle type="resize-r"  style={{left:'100%', top:'50%'}}/>
                {/* Rotar — naranja */}
                <Handle type="rotate"    style={{left:'50%',  top:-22}}/>
                <div style={{
                  position:'absolute',left:'50%',top:-18,
                  width:1,height:18,background:'#f59e0b',
                  transform:'translateX(-50%)',
                  zIndex:9, pointerEvents:'none',
                }}/>
                {/* Info */}
                <div style={{
                  position:'absolute', bottom:-18, left:0,
                  fontSize:9, color:'#60a5fa', whiteSpace:'nowrap',
                  background:'rgba(0,0,0,.75)', padding:'1px 5px', borderRadius:3,
                  pointerEvents:'none',
                }}>
                  {Math.round(el.x)},{Math.round(el.y)} · {Math.round(el.w)}×{Math.round(el.h)}
                  {rot!==0?` · ${rot}°`:''}
                </div>
              </>}
            </div>
          )
        })}
      </div>

      {/* Panel de capas — seleccionar cualquier elemento directamente */}
      {plantilla.elementos?.length>0&&(
        <div style={{
          marginTop:8, padding:'6px 8px',
          background:'rgba(0,0,0,.5)', borderRadius:6,
          border:'1px solid #374151', width:W,
        }}>
          <div style={{fontSize:9,color:'#6B7280',textTransform:'uppercase',
            fontWeight:700,marginBottom:4,letterSpacing:'.05em'}}>
            Capas — clic para seleccionar
          </div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[...plantilla.elementos].reverse().map((el,ri)=>{
              const realIdx = plantilla.elementos.length-1-ri
              const isSel = sel===el.id
              const iconos = {texto:'T',precio:'$',rect:'▬',imagen:'🖼'}
              return(
                <button key={el.id}
                  onClick={e=>{e.stopPropagation();setSel(el.id);onSelChange&&onSelChange(String(el.id))}}
                  style={{
                    padding:'3px 8px', borderRadius:5, cursor:'pointer',
                    fontSize:10, fontWeight:isSel?700:400,
                    border:`1.5px solid ${isSel?'#3b82f6':'#374151'}`,
                    background:isSel?'rgba(59,130,246,.2)':'rgba(55,65,81,.5)',
                    color:isSel?'#60a5fa':'#9CA3AF',
                    display:'flex',alignItems:'center',gap:3,
                  }}>
                  <span>{iconos[el.tipo]||'?'}</span>
                  <span style={{maxWidth:70,overflow:'hidden',
                    textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {el.tipo==='imagen'?'Imagen':
                     el.tipo==='rect'?'Rect':
                     (el.texto||'').replace(/\{\{|\}\}/g,'').slice(0,12)||el.tipo}
                  </span>
                  {realIdx===0&&(
                    <span style={{fontSize:8,color:'#f59e0b'}}>●fondo</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Preview de una etiqueta (solo lectura) ─────────────────────
function PreviewEtiqueta({plantilla, tamano, producto, scale=1, tipoPrecioSel}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const w = tamano.w
  const h = tamano.h
  return(
    <div style={{
      width:w*scale, height:h*scale,
      background:plantilla.bg||'#ffffff',
      position:'relative',
      overflow:'hidden',
      fontFamily:'sans-serif',
      flexShrink:0,
      // Clip exacto al tamaño del papel
      clipPath:`inset(0 0 0 0)`,
    }}>
      {plantilla.elementos?.map((el,idx)=>{
        const rot = el.rot||0
        const base={
          position:'absolute',
          left:el.x*scale, top:el.y*scale,
          width:el.w*scale, height:el.h*scale,
          transform:`rotate(${rot}deg)`,
          transformOrigin:'center center',
          overflow:(el.tipo==='imagen'||el.tipo==='rect')?'hidden':'visible',
          zIndex:idx+1,
          pointerEvents:'none',
        }
        if(el.tipo==='rect') return(
          <div key={el.id} style={{...base,
            background: el.sinFondo ? 'transparent' : (el.color||'#000'),
            border: el.borderColor ? `${el.borderWidth||2}px solid ${el.borderColor}` : 'none',
            borderRadius: el.borderRadius ? `${el.borderRadius*scale}px` : 0,
            boxSizing:'border-box',
          }}/>
        )
        if(el.tipo==='imagen') return(
          el.src
            ? <img key={el.id} src={el.src} draggable={false}
                style={{...base, objectFit:'fill'}}/>
            : null
        )
        if(el.tipo==='barcode') {
          const bt = resolverVars('{{codigo_barras}}', producto, tipoPrecioSel)
          return(
            <div key={el.id} style={{...base,background:'white',
              display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',padding:2}}>
              <BarcodeCanvas text={bt}
                width={Math.max(30,(el.w-4)*scale)}
                height={Math.max(15,(el.h-16)*scale)}
                color={el.color||'#000000'}/>
              <div style={{fontSize:Math.max(5,(el.fontSize||8)*scale),
                color:el.color||'#000',marginTop:1,
                letterSpacing:'0.08em',fontFamily:'monospace'}}>
                {bt}
              </div>
            </div>
          )
        }
        if(el.tipo==='texto'||el.tipo==='precio') return(
          <div key={el.id} style={{
            ...base,
            fontSize:(el.fontSize||12)*scale,
            fontWeight:el.bold?'bold':'normal',
            fontStyle:el.italic?'italic':'normal',
            textDecoration:el.tachado?'line-through':'none',
            color:el.color||'#000',
            textAlign:el.align||'left',
            fontFamily:el.fontFamily||'inherit',
            display:'flex', alignItems:'center',
            justifyContent:el.align==='center'?'center':
              el.align==='right'?'flex-end':'flex-start',
            padding:`0 ${2*scale}px`,
            lineHeight:1.2,
            whiteSpace:'pre-wrap',
            wordBreak:'break-word',
          }}>
            {resolverVars(el.texto, producto, tipoPrecioSel)}
          </div>
        )
        return null
      })}
    </div>
  )
}

// ── Galería de imágenes del servidor ─────────────────────────
function GaleriaImagenes({onSeleccionar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [imgs,    setImgs]    = useState([])
  const [abierto, setAbierto] = useState(false)
  const [cargando,setCargando]= useState(false)

  async function cargar() {
    setCargando(true)
    try{
      const token=localStorage.getItem('nexus_token')
      const res=await fetch('${API_HOST}/api/imagenes?carpeta=etiquetas',
        {headers:{Authorization:'Bearer '+token}})
      setImgs(await res.json())
    }catch{}finally{setCargando(false)}
  }

  async function eliminar(img,e) {
    e.stopPropagation()
    if(!window.confirm('¿Eliminar esta imagen del servidor?')) return
    const token=localStorage.getItem('nexus_token')
    await fetch(`${API_HOST}/api/imagenes/${img.carpeta}/${img.filename}`,
      {method:'DELETE',headers:{Authorization:'Bearer '+token}})
    setImgs(p=>p.filter(i=>i.filename!==img.filename))
  }

  return(
    <div style={{marginBottom:5}}>
      <button onClick={()=>{setAbierto(!abierto);if(!abierto)cargar()}}
        style={{width:'100%',padding:'6px',borderRadius:7,cursor:'pointer',
          fontSize:11,fontWeight:600,
          border:`1px solid ${C.bord2}`,background:C.sur2,color:C.muted}}>
        {abierto?'▲ Cerrar galería':'📂 Galería de imágenes subidas'}
      </button>
      {abierto&&(
        <div style={{marginTop:5,background:C.sur3,borderRadius:8,
          padding:8,border:`1px solid ${C.bord2}`,maxHeight:180,overflowY:'auto'}}>
          {cargando&&<div style={{fontSize:11,color:C.hint,textAlign:'center',padding:8}}>Cargando...</div>}
          {!cargando&&imgs.length===0&&(
            <div style={{fontSize:11,color:C.hint,textAlign:'center',padding:8}}>
              Sin imágenes subidas
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
            {imgs.map(img=>(
              <div key={img.filename}
                onClick={()=>{onSeleccionar(img.url);setAbierto(false)}}
                style={{position:'relative',cursor:'pointer',borderRadius:5,
                  overflow:'hidden',aspectRatio:'1',background:'#fff',
                  border:`1px solid ${C.bord2}`}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.bord2}>
                <img src={API_HOST+img.url}
                  style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                <button onClick={e=>eliminar(img,e)}
                  style={{position:'absolute',top:2,right:2,background:'rgba(239,68,68,.9)',
                    border:'none',borderRadius:'50%',width:16,height:16,cursor:'pointer',
                    fontSize:9,color:'white',display:'flex',alignItems:'center',
                    justifyContent:'center',lineHeight:1}}>×</button>
                <div style={{position:'absolute',bottom:0,left:0,right:0,
                  background:'rgba(0,0,0,.6)',fontSize:8,color:'white',
                  padding:'1px 3px',textOverflow:'ellipsis',overflow:'hidden',
                  whiteSpace:'nowrap'}}>
                  {img.size_kb}KB
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Editor de elemento ────────────────────────────────────────
function EditorElemento({el, idx, totalEls, onChange, onDelete, onMover, producto, tamano}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const tipos = ['texto','precio','barcode','rect','imagen']
  return(
    <div style={{background:C.sur3,borderRadius:8,padding:10,marginBottom:8,
      border:`1px solid ${C.bord2}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <select value={el.tipo} onChange={e=>onChange({...el,tipo:e.target.value})}
          style={{...FI,width:90,padding:'4px 6px',fontSize:11}}>
          {tipos.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {/* Controles de capa */}
        <div style={{display:'flex',gap:3,alignItems:'center'}}>
          <button title="Al fondo" onClick={()=>onMover('fondo')}
            style={{padding:'3px 6px',borderRadius:5,cursor:'pointer',fontSize:10,
              border:`1px solid ${C.bord2}`,background:C.sur2,color:C.hint,fontWeight:700}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.blueD;e.currentTarget.style.color=C.blue}}
            onMouseLeave={e=>{e.currentTarget.style.background=C.sur2;e.currentTarget.style.color=C.hint}}>
            ⬇⬇
          </button>
          <button title="Bajar capa" onClick={()=>onMover('bajar')} disabled={idx===0}
            style={{padding:'3px 6px',borderRadius:5,cursor:idx===0?'default':'pointer',fontSize:10,
              border:`1px solid ${C.bord2}`,background:C.sur2,
              color:idx===0?'#374151':C.hint,fontWeight:700}}>
            ⬇
          </button>
          <button title="Subir capa" onClick={()=>onMover('subir')} disabled={idx===totalEls-1}
            style={{padding:'3px 6px',borderRadius:5,cursor:idx===totalEls-1?'default':'pointer',fontSize:10,
              border:`1px solid ${C.bord2}`,background:C.sur2,
              color:idx===totalEls-1?'#374151':C.hint,fontWeight:700}}>
            ⬆
          </button>
          <button title="Al frente" onClick={()=>onMover('frente')}
            style={{padding:'3px 6px',borderRadius:5,cursor:'pointer',fontSize:10,
              border:`1px solid ${C.bord2}`,background:C.sur2,color:C.hint,fontWeight:700}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.blueD;e.currentTarget.style.color=C.blue}}
            onMouseLeave={e=>{e.currentTarget.style.background=C.sur2;e.currentTarget.style.color=C.hint}}>
            ⬆⬆
          </button>
          <button onClick={onDelete}
            style={{padding:'3px 7px',borderRadius:5,cursor:'pointer',fontSize:13,
              border:`1px solid ${C.bord2}`,background:C.sur2,color:C.hint}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.redD;e.currentTarget.style.color=C.red}}
            onMouseLeave={e=>{e.currentTarget.style.background=C.sur2;e.currentTarget.style.color=C.hint}}>
            ×
          </button>
        </div>
      </div>
      {/* Info barcode */}
      {el.tipo==='barcode'&&(
        <div style={{fontSize:10,color:C.cyan,marginBottom:6,padding:'4px 8px',
          borderRadius:6,background:'rgba(6,182,212,.1)',border:'1px solid rgba(6,182,212,.2)'}}>
          {'Usa el campo "Código de barras" del producto, o el código si no tiene.'}
        </div>
      )}
      {/* Badge de capa */}
      <div style={{fontSize:9,color:C.hint,marginBottom:6}}>
        Capa {idx+1} de {totalEls}
        {idx===0&&<span style={{marginLeft:5,color:C.amber,fontWeight:700}}>— FONDO</span>}
        {idx===totalEls-1&&totalEls>1&&<span style={{marginLeft:5,color:C.blue,fontWeight:700}}>— FRENTE</span>}
      </div>

      {/* Posición, tamaño y rotación */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:5,marginBottom:6}}>
        {[['x','X'],['y','Y'],['w','W'],['h','H'],['rot','°']].map(([k,l])=>(
          <div key={k}>
            <div style={{fontSize:9,color:C.hint,marginBottom:2}}>{l}</div>
            <input type="number" value={el[k]} onChange={e=>onChange({...el,[k]:parseInt(e.target.value)||0})}
              style={{...FI,padding:'3px 5px',fontSize:11,textAlign:'center'}}/>
          </div>
        ))}
      </div>

      {/* Color */}
      <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
        <div style={{fontSize:10,color:C.hint,width:40}}>Color:</div>
        <input type="color" value={el.color||'#000000'}
          onChange={e=>onChange({...el,color:e.target.value})}
          style={{width:32,height:24,border:'none',cursor:'pointer',borderRadius:4}}/>
        {el.tipo!=='rect'&&(
          <input value={el.color||''} onChange={e=>onChange({...el,color:e.target.value})}
            style={{...FI,width:80,padding:'3px 5px',fontSize:10}}/>
        )}
      </div>

      {/* Controles especiales para rectángulo */}
      {el.tipo==='rect'&&(
        <div style={{marginBottom:8,background:C.sur3,borderRadius:8,padding:8}}>
          {/* Fondo */}
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
            <label style={{display:'flex',alignItems:'center',gap:5,
              cursor:'pointer',fontSize:11,color:C.muted}}>
              <input type="checkbox"
                checked={el.sinFondo!==true}
                onChange={e=>onChange({...el,sinFondo:!e.target.checked})}
                style={{accentColor:C.blue}}/>
              Relleno
            </label>
            {el.sinFondo!==true&&(
              <input type="color" value={el.color||'#000000'}
                onChange={e=>onChange({...el,color:e.target.value})}
                style={{width:28,height:22,border:'none',cursor:'pointer',borderRadius:4}}/>
            )}
            {el.sinFondo!==true&&(
              <input value={el.color||'#000000'}
                onChange={e=>onChange({...el,color:e.target.value})}
                style={{...FI,width:70,padding:'2px 5px',fontSize:10}}/>
            )}
          </div>
          {/* Borde */}
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
            <label style={{display:'flex',alignItems:'center',gap:5,
              cursor:'pointer',fontSize:11,color:C.muted}}>
              <input type="checkbox"
                checked={!!el.borderColor}
                onChange={e=>onChange({...el,
                  borderColor: e.target.checked?(el.borderColor||'#000000'):undefined,
                  borderWidth: e.target.checked?(el.borderWidth||2):undefined,
                })}
                style={{accentColor:C.blue}}/>
              Borde
            </label>
            {!!el.borderColor&&(
              <input type="color" value={el.borderColor||'#000000'}
                onChange={e=>onChange({...el,borderColor:e.target.value})}
                style={{width:28,height:22,border:'none',cursor:'pointer',borderRadius:4}}/>
            )}
            {!!el.borderColor&&(
              <input value={el.borderColor||'#000000'}
                onChange={e=>onChange({...el,borderColor:e.target.value})}
                style={{...FI,width:70,padding:'2px 5px',fontSize:10}}/>
            )}
          </div>
          {/* Grosor del borde */}
          {!!el.borderColor&&(
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{fontSize:10,color:C.hint,width:40}}>Grosor:</div>
              {[1,2,3,4,6,8].map(w=>(
                <button key={w} onClick={()=>onChange({...el,borderWidth:w})}
                  style={{padding:'2px 7px',borderRadius:5,cursor:'pointer',
                    fontSize:10,fontWeight:el.borderWidth===w?800:400,
                    border:`1px solid ${el.borderWidth===w?C.blue:C.bord2}`,
                    background:el.borderWidth===w?C.blueD:C.sur2,
                    color:el.borderWidth===w?C.blue:C.hint}}>
                  {w}px
                </button>
              ))}
            </div>
          )}
          {/* Radio de esquinas */}
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6}}>
            <div style={{fontSize:10,color:C.hint,width:40}}>Radio:</div>
            {[0,4,8,12,20,50].map(r=>(
              <button key={r} onClick={()=>onChange({...el,borderRadius:r})}
                style={{padding:'2px 7px',borderRadius:5,cursor:'pointer',
                  fontSize:10,fontWeight:(el.borderRadius||0)===r?800:400,
                  border:`1px solid ${(el.borderRadius||0)===r?C.blue:C.bord2}`,
                  background:(el.borderRadius||0)===r?C.blueD:C.sur2,
                  color:(el.borderRadius||0)===r?C.blue:C.hint}}>
                {r===50?'⬤':r===0?'▬':r+'px'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Campos de texto */}
      {(el.tipo==='texto'||el.tipo==='precio')&&<>
        <div style={{marginBottom:6}}>
          <div style={{fontSize:10,color:C.hint,marginBottom:3}}>Texto / Variable:</div>
          <input value={el.texto||''} onChange={e=>onChange({...el,texto:e.target.value})}
            style={FI}/>
          <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:4}}>
            {['Producto','Precios','Oferta'].map(grupo=>{
              const vars = VARIABLES.filter(v=>v.g===grupo)
              const colores = {
                Producto:'#374151',
                Precios:'rgba(16,185,129,.2)',
                Oferta:'rgba(245,158,11,.2)',
              }
              const textCol = {
                Producto:C.hint,
                Precios:C.green,
                Oferta:C.amber,
              }
              return(
                <div key={grupo} style={{width:'100%',marginBottom:4}}>
                  <div style={{fontSize:9,color:textCol[grupo],fontWeight:700,
                    textTransform:'uppercase',marginBottom:3,
                    letterSpacing:'.05em'}}>
                    {grupo==='Producto'?'📦':grupo==='Precios'?'💲':'🏷'} {grupo}
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                    {vars.map(v=>(
                      <button key={v.v}
                        onClick={()=>onChange({...el,texto:(el.texto||'')+v.v})}
                        title={v.v}
                        style={{fontSize:9,padding:'3px 6px',borderRadius:5,cursor:'pointer',
                          border:`1px solid ${C.bord2}`,
                          background:colores[grupo],
                          color:textCol[grupo]}}>
                        {v.e} {v.l}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'60px 1fr 60px',gap:5}}>
          <div>
            <div style={{fontSize:10,color:C.hint,marginBottom:2}}>Fuente:</div>
            <input type="number" value={el.fontSize||12} onChange={e=>{
              const fs=parseInt(e.target.value)||12
              // Auto-ajustar alto: ~1.4x el tamaño de fuente + padding
              const newH = Math.max(el.h, Math.ceil(fs*1.5)+8)
              onChange({...el, fontSize:fs, h:newH})
            }}
              style={{...FI,padding:'3px 5px',fontSize:11,textAlign:'center'}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.hint,marginBottom:2}}>Alineación:</div>
            <div style={{display:'flex',gap:3}}>
              {['left','center','right'].map(a=>(
                <button key={a} onClick={()=>onChange({...el,align:a})}
                  style={{flex:1,padding:'4px',borderRadius:5,cursor:'pointer',fontSize:11,
                    border:`1px solid ${el.align===a?C.blue:C.bord2}`,
                    background:el.align===a?C.blueD:C.sur2,
                    color:el.align===a?C.blue:C.hint}}>
                  {a==='left'?'⬅':a==='center'?'⬛':'➡'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.hint,marginBottom:2}}>Estilo:</div>
            <div style={{display:'flex',gap:3}}>
              <button onClick={()=>onChange({...el,bold:!el.bold})}
                title="Negrita"
                style={{flex:1,padding:'4px',borderRadius:5,cursor:'pointer',
                  fontSize:13,fontWeight:'bold',
                  border:`1px solid ${el.bold?C.blue:C.bord2}`,
                  background:el.bold?C.blueD:C.sur2,
                  color:el.bold?C.blue:C.hint}}>
                B
              </button>
              <button onClick={()=>onChange({...el,italic:!el.italic})}
                title="Itálica"
                style={{flex:1,padding:'4px',borderRadius:5,cursor:'pointer',
                  fontSize:13,fontStyle:'italic',fontWeight:600,
                  border:`1px solid ${el.italic?C.blue:C.bord2}`,
                  background:el.italic?C.blueD:C.sur2,
                  color:el.italic?C.blue:C.hint}}>
                I
              </button>
              <button onClick={()=>onChange({...el,tachado:!el.tachado})}
                title="Tachado (precio original)"
                style={{flex:1,padding:'4px',borderRadius:5,cursor:'pointer',
                  fontSize:13,textDecoration:'line-through',fontWeight:600,
                  border:`1px solid ${el.tachado?C.amber:C.bord2}`,
                  background:el.tachado?C.amberD:C.sur2,
                  color:el.tachado?C.amber:C.hint}}>
                S
              </button>
            </div>
          </div>
        </div>
        {/* Selector de tipografía */}
        <div style={{marginTop:6}}>
          <div style={{fontSize:10,color:C.hint,marginBottom:3,fontWeight:600}}>
            Tipografía
          </div>
          <select value={el.fontFamily||'sans-serif'}
            onChange={e=>onChange({...el,fontFamily:e.target.value})}
            style={{...FI,fontSize:11,
              fontFamily:el.fontFamily||'sans-serif'}}>
            {FUENTES.map(f=>(
              <option key={f.v} value={f.v}>{f.l}</option>
            ))}
          </select>
          {/* Preview de la tipografía */}
          <div style={{
            marginTop:4,padding:'6px 8px',borderRadius:6,
            background:C.sur3,
            fontFamily:el.fontFamily||'sans-serif',
            fontSize:Math.min(el.fontSize||12,16),
            fontWeight:el.bold?'bold':'normal',
            fontStyle:el.italic?'italic':'normal',
            textDecoration:el.tachado?'line-through':'none',
            color:el.color||'#F9FAFB',
            textAlign:'center',
            overflow:'hidden',
            whiteSpace:'nowrap',
            textOverflow:'ellipsis',
          }}>
            AaBbCc 123 $%
          </div>
        </div>
      </>}

      {/* Imagen */}
      {el.tipo==='imagen'&&(
        <div>
          {/* Preview */}
          {el.src&&(
            <div style={{marginBottom:8,borderRadius:6,overflow:'hidden',
              border:`1px solid ${C.bord2}`,background:'#fff',
              display:'flex',alignItems:'center',justifyContent:'center',height:60}}>
              <img src={el.src.startsWith('__ref:')?'':el.src}
                style={{maxHeight:56,maxWidth:'100%',objectFit:'contain'}}
                onError={e=>e.target.style.display='none'}/>
            </div>
          )}
          {/* Estado */}
          <div style={{fontSize:9,marginBottom:6,padding:'3px 7px',borderRadius:5,
            background:el.src?C.greenD:C.sur3,
            color:el.src?C.green:C.hint,
            border:`1px solid ${el.src?'rgba(16,185,129,.3)':C.bord2}`}}>
            {el.src
              ? el.src.startsWith('/uploads/')
                ? '✅ Imagen en servidor — permanente'
                : el.src.startsWith('data:')
                  ? '✅ Imagen embebida (base64)'
                  : '⚠ URL externa — puede cambiar'
              : 'Sin imagen'}
          </div>
          {/* Subir al servidor */}
          <label style={{display:'flex',alignItems:'center',justifyContent:'center',
            gap:6,padding:'8px',borderRadius:8,cursor:'pointer',fontSize:12,
            fontWeight:700,background:C.blue,color:'white',marginBottom:5}}>
            <input type="file" accept="image/*" style={{display:'none'}}
              onChange={async e=>{
                const file=e.target.files[0]; if(!file) return
                if(file.size>5*1024*1024){
                  alert('Máximo 5MB por imagen'); return
                }
                const fd=new FormData(); fd.append('file',file); fd.append('carpeta','etiquetas')
                try{
                  const token=localStorage.getItem('nexus_token')
                  const res=await fetch('${API_HOST}/api/imagenes/subir',{
                    method:'POST',headers:{Authorization:'Bearer '+token},body:fd
                  })
                  const data=await res.json()
                  if(data.url) onChange({...el,src:API_HOST+data.url})
                  else alert('Error al subir: '+JSON.stringify(data))
                }catch(err){alert('Error: '+err.message)}
              }}/>
            🖼 {el.src?'Cambiar':'Subir'} imagen al servidor
          </label>
          {/* Galería de imágenes subidas */}
          <GaleriaImagenes onSeleccionar={url=>onChange({...el,src:API_HOST+url})}/>
          {/* Quitar */}
          {el.src&&(
            <button onClick={()=>onChange({...el,src:''})}
              style={{width:'100%',marginTop:5,padding:'5px',borderRadius:6,
                cursor:'pointer',fontSize:11,
                border:`1px solid ${C.bord2}`,background:C.sur2,color:C.hint}}>
              🗑 Quitar imagen
            </button>
          )}
          {tamano&&(
            <button onClick={()=>onChange({...el,x:0,y:0,w:tamano.w,h:tamano.h,rot:0})}
              style={{width:'100%',marginTop:5,padding:'6px',borderRadius:7,
                cursor:'pointer',fontSize:11,fontWeight:700,
                border:`1px solid ${C.blue}44`,background:C.blueD,color:C.blue}}>
              ⬛ Ajustar al papel ({tamano.wMm}×{tamano.hMm}mm)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Etiquetas() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  // Cargar plantillas guardadas de la BD
  const [plantillasGuardadas, setPlantillasGuardadas] = useState([])

  useEffect(()=>{
    api.get('/etiquetas/plantillas').then(r=>{
      const bd = Array.isArray(r.data)?r.data:[]
      if(bd.length>0){
        setPlantillasGuardadas(bd.map(p=>({
          ...JSON.parse(p.datos||'{}'),
          id: p.id,
          nombre: p.nombre,
        })))
      } else {
        // Fallback: migrar desde localStorage si hay datos
        try {
          const local = JSON.parse(localStorage.getItem('nexus_etiquetas')||'[]')
          if(local.length>0){
            setPlantillasGuardadas(local)
            // Migrar a BD
            local.forEach(p=>{
              api.post('/etiquetas/plantillas',{
                nombre: p.nombre||'Plantilla',
                datos: JSON.stringify(p)
              }).catch(()=>{})
            })
          }
        } catch {}
      }
    }).catch(()=>{
      try { setPlantillasGuardadas(JSON.parse(localStorage.getItem('nexus_etiquetas')||'[]')) }
      catch {}
    })
  },[])
  const [plantilla, setPlantillaBase] = useState(()=>{
    // Restaurar borrador activo primero, si no la última guardada
    try {
      const borrador = localStorage.getItem('nexus_etiquetas_borrador')
      if(borrador) {
        const d = JSON.parse(borrador)
        // Resolver refs de imágenes
        d.elementos = (d.elementos||[]).map(el=>{
          if(el.tipo==='imagen'&&el.src&&el.src.startsWith('__ref:')) {
            return {...el, src:localStorage.getItem(el.src.replace('__ref:',''))||''}
          }
          return el
        })
        return d
      }
      const saved = JSON.parse(localStorage.getItem('nexus_etiquetas')||'[]')
      if(saved.length>0) return {...PLANTILLA_VACIA, elementos:[...saved[saved.length-1].elementos]}
    } catch {}
    return {...PLANTILLA_VACIA, elementos:[]}
  })
  const [bgColor, setBgColorState] = useState(()=>{
    try {
      const b = localStorage.getItem('nexus_etiquetas_borrador')
      if(b) return JSON.parse(b).bg||'#ffffff'
    } catch {}
    return '#ffffff'
  })
  const [nombreGuardar, setNombreGuardar] = useState('')
  const [busqPlantilla, setBusqPlantilla] = useState('')
  const [modalGuardar,  setModalGuardar]  = useState(false)
  const [plantillaEditId, setPlantillaEditId] = useState(null) // id de la plantilla que estamos editando
  const [tamano,       setTamano]        = useState(()=>{
    try {
      const b = localStorage.getItem('nexus_etiquetas_borrador')
      if(b) {
        const d=JSON.parse(b)
        if(d.tamanoId) return TAMANHOS.find(t=>t.id===d.tamanoId)||TAMANHOS[0]
      }
    } catch {}
    return TAMANHOS[0]
  })
  const [tamanoCustomMm, setTamanoCustomMm] = useState(()=>{
    try {
      const b = localStorage.getItem('nexus_etiquetas_borrador')
      if(b) { const d=JSON.parse(b); if(d.tamanoCustomMm) return d.tamanoCustomMm }
    } catch {}
    return {wMm:80,hMm:50}
  })
  const [tiposPrecio,  setTiposPrecio]   = useState([])
  const [tipoPrecioSel,setTipoPrecioSel] = useState('')
  const [categorias,   setCategorias]    = useState([])
  const [marcas,       setMarcas]        = useState([])
  const [selProd,      setSelProd]       = useState([])
  const [disenoImpId,  setDisenoImpId]   = useState(null)  // id de plantilla guardada para imprimir
  const [busqueda,     setBusqueda]      = useState('')
  const [modoFiltro,   setModoFiltro]    = useState('buscar') // buscar|categoria|marca
  const [filtCatId,    setFiltCatId]     = useState('')
  const [filtMarcaId,  setFiltMarcaId]   = useState('')
  const [cargandoProd, setCargandoProd]  = useState(false)
  const [busRes,       setBusRes]        = useState([])
  const [cantidad,     setCantidad]      = useState(1)
  const [tab,          setTab]           = useState('editor') // editor|imprimir (dentro de vista=editor)
  const setBgColor = (v) => {
    setBgColorState(v)
  }
  const [searchParams] = useSearchParams()
  const printRef = useRef()

  // Usuario y permisos
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const rolUser = (user.rol||'').toLowerCase().trim()
  // Mientras no haya sistema de usuarios configurado, todos pueden editar
  // Solo bloquear si el rol es explícitamente 'usuario' o 'vendedor'
  const puedeEditar = !['usuario','vendedor','cajero','operador'].includes(rolUser)
  const puedeImprimir = true
  const [vista, setVista] = useState('lista')
  const [zoom, setZoom] = useState(1.0)  // zoom del canvas editor
  const [selId, setSelId] = useState(null)  // id del elemento seleccionado en canvas

  // Si viene del dashboard con productos pre-seleccionados
  useEffect(()=>{
    const from = searchParams.get('from')
    if(from==='dashboard'||from==='oferta'){
      try{
        const prods = JSON.parse(sessionStorage.getItem('nexus_etiqueta_prods')||'[]')
        if(prods.length>0){
          setSelProd(prods)
          setTab('imprimir')
          setVista('editor')  // ir directo al módulo de impresión
          sessionStorage.removeItem('nexus_etiqueta_prods')
        }
        const tipoPrecioId = sessionStorage.getItem('nexus_tipo_precio_sel')
        if(tipoPrecioId) {
          setTipoPrecioSel(tipoPrecioId)
          sessionStorage.removeItem('nexus_tipo_precio_sel')
        }
      }catch{}
    }
  },[])

  // Al imprimir — marcar automáticamente como impresos
  async function imprimirYMarcar() {
    imprimir()
    // Marcar historial de precios como impreso
    try{
      const hIds = JSON.parse(sessionStorage.getItem('nexus_etiqueta_historial_ids')||'[]')
      if(hIds.length) {
        await api.post('/precios/marcar-impreso', {ids:hIds})
        sessionStorage.removeItem('nexus_etiqueta_historial_ids')
      }
    }catch{}
    // Marcar ofertas como impresas
    try{
      const oIds = JSON.parse(sessionStorage.getItem('nexus_oferta_ids')||'[]')
      if(oIds.length) {
        await api.post('/ofertas/marcar-impresas', {ids:oIds})
        sessionStorage.removeItem('nexus_oferta_ids')
      }
    }catch{}
  }

  // Cargar datos al montar
  useEffect(()=>{
    api.get('/tipos-precio').then(r=>setTiposPrecio(r.data||[])).catch(()=>{})
    api.get('/etiquetas/categorias').then(r=>setCategorias(r.data||[])).catch(()=>{})
    api.get('/etiquetas/marcas').then(r=>setMarcas(r.data||[])).catch(()=>{})
    try {
      const saved = JSON.parse(localStorage.getItem('nexus_etiquetas')||'[]')
      setPlantillasGuardadas(saved)
      // Restaurar qué plantilla estaba editando
      const borrador = localStorage.getItem('nexus_etiquetas_borrador')
      if(borrador) {
        const d = JSON.parse(borrador)
        if(d._editId) {
          const p = saved.find(x=>x.id===d._editId)
          if(p) { setPlantillaEditId(d._editId); setNombreGuardar(p.nombre) }
        }
      }
    } catch {}
  },[])



  // Auto-guardar borrador cada vez que cambia el diseño
  useEffect(()=>{
    try {
      const borrador = {
        ...plantilla,
        bg: bgColor,
        tamanoId: tamano.id,
        tamanoCustomMm,
        savedAt: new Date().toISOString(),
        _editId: plantillaEditId,  // recordar cuál estamos editando
      }
      localStorage.setItem('nexus_etiquetas_borrador', JSON.stringify(borrador))
    } catch {}
  },[plantilla, bgColor, tamano, tamanoCustomMm])

  const tamanoActual = tamano.id==='custom'
    ? {...tamano, wMm:tamanoCustomMm.wMm, hMm:tamanoCustomMm.hMm,
        w:mm2px(tamanoCustomMm.wMm), h:mm2px(tamanoCustomMm.hMm)}
    : tamano



  function _buildElementos() {
    return (plantilla.elementos||[]).map(el=>{
      if(el.tipo==='imagen' && el.src?.startsWith('data:')) {
        const imgKey='nexus_img_'+(el.id||Date.now())
        try{ localStorage.setItem(imgKey, el.src) }catch{}
        return {...el, src:'__ref:'+imgKey}
      }
      return el
    })
  }

  // Guardar directo — sobreescribe la plantilla actual sin pedir nombre
  function guardarDirecto() {
    if(!plantillaEditId || !nombreGuardar) return
    const actualizada = {
      id: plantillaEditId,
      nombre: nombreGuardar,
      fecha: new Date().toLocaleDateString('es-EC'),
      tamanoId: tamano.id,
      tamanoCustomMm,
      bgColor,
      elementos: _buildElementos(),
    }
    let base = []
    try { base = JSON.parse(localStorage.getItem('nexus_etiquetas')||'[]') } catch {}
    const actualizadas = base.map(p=>p.id===plantillaEditId ? actualizada : p)
    setPlantillasGuardadas(actualizadas)
    try {
      localStorage.setItem('nexus_etiquetas', JSON.stringify(actualizadas))
    } catch(e) { alert('Error al guardar: '+e.message) }
  }

  // Guardar nueva o con nombre diferente — abre modal
  function guardarPlantilla() {
    if(!nombreGuardar.trim()) return

    const esNueva = !plantillaEditId
    const id = esNueva ? Date.now() : (
      // Checar si cambiaron el nombre — si sí, crear nueva
      plantillasGuardadas.find(p=>p.id===plantillaEditId)?.nombre === nombreGuardar.trim()
        ? plantillaEditId
        : Date.now()
    )

    const nueva = {
      id,
      nombre: nombreGuardar.trim(),
      fecha: new Date().toLocaleDateString('es-EC'),
      tamanoId: tamano.id,
      tamanoCustomMm,
      bgColor,
      elementos: _buildElementos(),
    }

    let base = []
    try { base = JSON.parse(localStorage.getItem('nexus_etiquetas')||'[]') } catch {}
    // Si mismo id: reemplazar. Si nuevo id: agregar
    const existe = base.find(p=>p.id===id)
    const actualizadas = existe
      ? base.map(p=>p.id===id ? nueva : p)
      : [...base.filter(p=>p.nombre!==nueva.nombre), nueva]

    setPlantillasGuardadas(actualizadas)
    setPlantillaEditId(nueva.id)
    try {
      localStorage.setItem('nexus_etiquetas', JSON.stringify(actualizadas))
    } catch(e) {
      try {
        const sinImg = actualizadas.map(p=>({...p,
          elementos:(p.elementos||[]).map(el=>el.tipo==='imagen'?{...el,src:''}:el)
        }))
        localStorage.setItem('nexus_etiquetas', JSON.stringify(sinImg))
        alert('Guardado sin imágenes por falta de espacio.')
      } catch(e2) { alert('No se pudo guardar: '+e2.message); return }
    }
    setModalGuardar(false)
  }

  // Resolver referencias de imágenes al cargar
  function resolverImagenes(elementos) {
    return (elementos||[]).map(el=>{
      if(el.tipo==='imagen' && el.src && el.src.startsWith('__ref:')) {
        const key = el.src.replace('__ref:','')
        const img = localStorage.getItem(key)||''
        return {...el, src:img}
      }
      return el
    })
  }

  function cargarPlantillaGuardada(p) {
    const elementos = resolverImagenes(p.elementos)
    setPlantillaBase(prev=>({...prev, elementos}))
    setBgColor(p.bgColor||'#ffffff')
    const tam = TAMANHOS.find(t=>t.id===p.tamanoId)||TAMANHOS[0]
    setTamano(tam)
    if(p.tamanoCustomMm) setTamanoCustomMm(p.tamanoCustomMm)
    // Recordar que estamos editando esta plantilla
    setPlantillaEditId(p.id)
    setNombreGuardar(p.nombre)
  }

  function eliminarPlantillaGuardada(id) {
    let base = []
    try { base = JSON.parse(localStorage.getItem('nexus_etiquetas')||'[]') } catch {}
    // Limpiar imágenes separadas
    const aElim = base.find(p=>p.id===id)
    if(aElim) {
      (aElim.elementos||[]).forEach(el=>{
        if(el.src&&el.src.startsWith('__ref:'))
          localStorage.removeItem(el.src.replace('__ref:',''))
      })
    }
    const actualizadas = base.filter(p=>p.id!==id)
    setPlantillasGuardadas(actualizadas)
    localStorage.setItem('nexus_etiquetas', JSON.stringify(actualizadas))
  }

  async function buscarProductos(v) {
    setBusqueda(v)
    if(v.length<2){setBusRes([]);return}
    try{
      const{data}=await api.get('/etiquetas/productos',{params:{busqueda:v,con_stock:false}})
      setBusRes(data.slice(0,10))
    }catch{}
  }

  async function cargarPorFiltro(catId, marcaId) {
    setCargandoProd(true)
    try{
      const params={con_stock:true}
      if(catId)   params.categoria_id=catId
      if(marcaId) params.marca_id=marcaId
      const{data}=await api.get('/etiquetas/productos',{params})
      setSelProd(data)
    }catch(e){alert('Error: '+e.message)}
    finally{setCargandoProd(false)}
  }

  function toggleProducto(p) {
    setSelProd(prev=>
      prev.find(x=>x.id===p.id)
        ? prev.filter(x=>x.id!==p.id)
        : [...prev, p]
    )
    setBusRes([])
    setBusqueda('')
  }

  function quitarTodos() {
    if(window.confirm('¿Quitar todos los productos?')) setSelProd([])
  }

  function updateElemento(idx, nuevoEl) {
    setPlantillaBase(prev=>({
      ...prev,
      elementos: prev.elementos.map((e,i)=>i===idx?nuevoEl:e)
    }))
  }

  function deleteElemento(idx) {
    setPlantillaBase(prev=>({
      ...prev,
      elementos: prev.elementos.filter((_,i)=>i!==idx)
    }))
  }

  function moverCapa(idx, dir) {
    setPlantillaBase(prev=>{
      const arr = [...prev.elementos]
      if(dir==='fondo')   { const [el]=arr.splice(idx,1); arr.unshift(el) }
      if(dir==='frente')  { const [el]=arr.splice(idx,1); arr.push(el) }
      if(dir==='subir'&&idx<arr.length-1) { [arr[idx],arr[idx+1]]=[arr[idx+1],arr[idx]] }
      if(dir==='bajar'&&idx>0)            { [arr[idx],arr[idx-1]]=[arr[idx-1],arr[idx]] }
      return {...prev, elementos:arr}
    })
  }

  function addElemento(tipo) {
    const newEl = {
      id: Date.now(),
      tipo, rot:0,
      x: 10, y: 10,
      w: tipo==='imagen' ? Math.round(tamanoActual.w*0.8)
         : tipo==='barcode' ? Math.round(tamanoActual.w*0.8)
         : tipo==='precio' ? Math.round(tamanoActual.w*0.7)
         : Math.round(tamanoActual.w*0.8),
      h: tipo==='imagen' ? Math.round(tamanoActual.h*0.6)
         : tipo==='barcode' ? 50
         : tipo==='precio' ? 50 : 25,
      texto: tipo==='precio'?'{{precio}}':tipo==='texto'?'Nuevo texto':'',
      fontSize: tipo==='precio'?28:tipo==='barcode'?8:12,
      bold: tipo==='precio',
      color: tipo==='precio'?'#10B981':'#000000',
      align:'center',
      src: '',
    }
    setPlantillaBase(prev=>({...prev, elementos:[...prev.elementos, newEl]}))
  }

  function generarEtiquetaHTML(producto, plantilla, tamano, tipoPrecioId) {
    const W = tamano.w, H = tamano.h
    const bg = plantilla.bg || '#ffffff'
    const elems = (plantilla.elementos||[]).map((el,idx) => {
      const rot = el.rot||0
      const style = [
        `position:absolute`,
        `left:${el.x}px`,`top:${el.y}px`,
        `width:${el.w}px`,`height:${el.h}px`,
        `transform:rotate(${rot}deg)`,
        `transform-origin:center center`,
        `z-index:${idx+1}`,
        `overflow:${(el.tipo==='imagen'||el.tipo==='rect')?'hidden':'visible'}`,
      ].join(';')

      if(el.tipo==='rect') {
        const bg   = el.sinFondo ? 'transparent' : (el.color||'#000')
        const bord = el.borderColor
          ? `${el.borderWidth||2}px solid ${el.borderColor}` : 'none'
        const brad = el.borderRadius ? `${el.borderRadius}px` : '0'
        return `<div style="${style};background:${bg};border:${bord};border-radius:${brad};box-sizing:border-box"></div>`
      }
      if(el.tipo==='imagen') {
        if(!el.src) return ''
        const imgSrc = el.src.startsWith('__ref:')
          ? (localStorage.getItem(el.src.replace('__ref:',''))||'') : el.src
        return `<img src="${imgSrc}" style="${style};object-fit:fill;display:block"/>`
      }
      if(el.tipo==='barcode') {
        const text = resolverVars('{{codigo_barras}}', producto, tipoPrecioId)||'BARCODE'
        const bars = makeBarcode(text)
        if(!bars||!bars.length) return ''
        const barW = el.w/bars.length
        let rects=[], i=0
        while(i<bars.length){
          if(bars[i]){let j=i;while(j<bars.length&&bars[j])j++;
            rects.push(`<rect x="${(i*barW).toFixed(2)}" y="0" width="${((j-i)*barW).toFixed(2)}" height="${Math.max(10,el.h-16)}" fill="${el.color||'#000'}"/>`)
            i=j}else i++
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${el.w}" height="${Math.max(10,el.h-16)}" style="display:block;shape-rendering:crispEdges"><rect width="${el.w}" height="${Math.max(10,el.h-16)}" fill="white"/>${rects.join('')}</svg>`
        const txt = `<div style="font-size:${el.fontSize||8}px;color:${el.color||'#000'};text-align:center;font-family:monospace;margin-top:2px">${text}</div>`
        return `<div style="${style};background:white;display:flex;flex-direction:column;align-items:center;justify-content:center">${svg}${txt}</div>`
      }
      if(el.tipo==='texto'||el.tipo==='precio') {
        const txt = resolverVars(el.texto||'', producto, tipoPrecioId)
        const align = el.align||'left'
        const jc = align==='center'?'center':align==='right'?'flex-end':'flex-start'
        const dec = el.tachado?'line-through':'none'
        const fst = el.italic?'italic':'normal'
        return `<div style="${style};font-size:${el.fontSize||12}px;font-weight:${el.bold?'bold':'normal'};font-style:${fst};text-decoration:${dec};color:${el.color||'#000'};text-align:${align};font-family:${el.fontFamily||'sans-serif'};display:flex;align-items:center;justify-content:${jc};padding:0 2px;line-height:1.2;white-space:pre-wrap;word-break:break-word">${txt}</div>`
      }
      return ''
    }).join('')
    return `<div style="position:relative;width:${W}px;height:${H}px;background:${bg};overflow:hidden;display:inline-block">${elems}</div>`
  }

  function imprimir() {
    if(!selProd.length) return
    const tam = tamanoImp

    // Generar HTML de todas las etiquetas directamente
    const etiquetasHTML = selProd.flatMap(p=>
      Array.from({length:cantidad},()=>
        `<div class="etiqueta-wrap">${generarEtiquetaHTML(p,plantillaImp,tam,tipoPrecioSel)}</div>`
      )
    ).join('')

    const win = window.open('','_blank','width=900,height=700')
    if(!win) { alert('Habilita las ventanas emergentes para imprimir'); return }

    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Etiquetas NEXUS</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fff;font-family:sans-serif}
  #controles{padding:12px 16px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;
    display:flex;gap:10px;align-items:center;print:none}
  #controles button{padding:8px 18px;border-radius:8px;cursor:pointer;
    font-weight:700;font-size:14px;border:none}
  #btn-print{background:#3B82F6;color:white}
  #btn-close{background:#e5e7eb;color:#374151}
  #info{font-size:12px;color:#6B7280;margin-left:auto}
  #etiquetas{padding:8px;display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-start}
  .etiqueta-wrap{display:inline-block;page-break-inside:avoid;break-inside:avoid}
  @media print{
    #controles{display:none!important}
    #etiquetas{padding:0;gap:2px}
    @page{margin:5mm}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style></head>
<body>
<div id="controles">
  <button id="btn-print" onclick="window.print()">🖨 Imprimir</button>
  <button id="btn-close" onclick="window.close()">✕ Cerrar</button>
  <span id="info">${selProd.length} producto${selProd.length!==1?'s':''} × ${cantidad} cop. = ${selProd.length*cantidad} etiqueta${selProd.length*cantidad!==1?'s':''} · ${tam.wMm||tam.w}×${tam.hMm||tam.h}mm</span>
</div>
<div id="etiquetas">${etiquetasHTML}</div>
</body></html>`)
    win.document.close()
  }

  const prodParaPreview = selProd[0] || {
    descripcion:'NOMBRE DEL PRODUCTO',
    codigo:'COD-001',
    codigo_barras:'COD-001',
    precio_venta:19.99,
    iva_porcentaje:15,
    marca_nombre:'MARCA',
    categoria_nombre:'CATEGORÍA',
    precios:[{tipo_precio_id:0,precio:17.38},{tipo_precio_id:-1,precio:15.99}],
    // Oferta de ejemplo para el preview
    tiene_oferta:true,
    precio_oferta:14.99,
    fecha_fin_oferta: new Date(Date.now()+7*86400000).toISOString().slice(0,10),
    fecha_ini_oferta: new Date().toISOString().slice(0,10),
    desc_oferta:'Oferta especial',
  }

  // Plantilla activa para impresión
  const plantillaImp = (() => {
    if(!disenoImpId) return {...plantilla, bg:bgColor}
    const pg = plantillasGuardadas.find(x=>x.id===disenoImpId)
    if(!pg) return {...plantilla, bg:bgColor}
    const elems = (pg.elementos||[]).map(el=>{
      if(el.src&&el.src.startsWith('__ref:'))
        return {...el, src:localStorage.getItem(el.src.replace('__ref:',''))||''}
      return el
    })
    return {...pg, elementos:elems, bg:pg.bgColor||'#ffffff'}
  })()
  const plantillaConBg = {...plantilla, bg:bgColor}

  // Tamaño del diseño seleccionado para impresión
  const tamanoImp = (() => {
    if(!disenoImpId) return tamanoActual
    const pg = plantillasGuardadas.find(x=>x.id===disenoImpId)
    if(!pg) return tamanoActual
    if(pg.tamanoId==='custom' && pg.tamanoCustomMm) {
      const {wMm,hMm} = pg.tamanoCustomMm
      return {id:'custom',nombre:'Personalizado',wMm,hMm,
        w:Math.round(wMm*3.7795),h:Math.round(hMm*3.7795)}
    }
    return TAMANHOS.find(t=>t.id===pg.tamanoId)||tamanoActual
  })()


  if(vista==='lista') return(
    <div style={{background:C.bg,minHeight:'100vh',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>
      <div style={{padding:'20px 28px',borderBottom:`1px solid ${C.bord2}`,
        background:C.surface,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:900}}>🏷 Etiquetas</h1>
          <p style={{margin:'3px 0 0',color:C.muted,fontSize:13}}>
            {plantillasGuardadas.length} diseño{plantillasGuardadas.length!==1?'s':''} guardado{plantillasGuardadas.length!==1?'s':''}
            <span style={{marginLeft:10,fontSize:10,padding:'1px 7px',borderRadius:10,
              background:puedeEditar?C.greenD:C.redD,
              color:puedeEditar?C.green:C.red,
              border:`1px solid ${puedeEditar?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`}}>
              {puedeEditar?'✓ Puede editar':'🔒 Solo impresión'}
              {' · rol: '}{rolUser||'sin rol'}
            </span>
          </p>
        </div>
        {puedeEditar&&(
          <button onClick={()=>{
            setPlantillaBase({...PLANTILLA_VACIA,elementos:[]})
            setBgColor('#ffffff')
            setPlantillaEditId(null)
            setNombreGuardar('')
            setTab('editor')
            setVista('editor')
          }} style={{padding:'9px 18px',borderRadius:10,cursor:'pointer',
              border:'none',background:C.purple,color:'white',fontSize:13,fontWeight:700}}>
            ✏️ Nuevo diseño
          </button>
        )}
      </div>
      <div style={{padding:28}}>
        <div style={{position:'relative',marginBottom:20,maxWidth:400}}>
          <span style={{position:'absolute',left:12,top:'50%',
            transform:'translateY(-50%)',color:C.hint}}>🔍</span>
          <input value={busqPlantilla} onChange={e=>setBusqPlantilla(e.target.value)}
            placeholder="Buscar etiqueta..."
            style={{background:C.surface,color:C.text,border:`1px solid ${C.bord2}`,
              borderRadius:9,padding:'9px 12px 9px 34px',width:'100%',fontSize:13}}/>
        </div>
        {plantillasGuardadas.length===0?(
          <div style={{textAlign:'center',padding:60,color:C.hint}}>
            <div style={{fontSize:40,marginBottom:12}}>🏷</div>
            <div style={{fontSize:16,fontWeight:700,color:C.muted,marginBottom:6}}>Sin etiquetas creadas</div>
            {puedeEditar&&(
              <button onClick={()=>{setTab('editor');setVista('editor')}}
                style={{marginTop:10,padding:'10px 24px',borderRadius:10,
                  border:'none',background:C.purple,color:'white',cursor:'pointer',fontSize:13,fontWeight:700}}>
                ✏️ Crear primer diseño
              </button>
            )}
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
            {plantillasGuardadas
              .filter(p=>!busqPlantilla||p.nombre.toLowerCase().includes(busqPlantilla.toLowerCase()))
              .map(p=>{
                const tamNom = p.tamanoId==='custom'
                  ? `${p.tamanoCustomMm?.wMm||'?'}×${p.tamanoCustomMm?.hMm||'?'}mm`
                  : TAMANHOS.find(t=>t.id===p.tamanoId)?.nombre||p.tamanoId||'—'
                const tamObj = p.tamanoId==='custom'
                  ? {id:'custom',wMm:p.tamanoCustomMm?.wMm||80,hMm:p.tamanoCustomMm?.hMm||50,
                      w:Math.round((p.tamanoCustomMm?.wMm||80)*3.78),h:Math.round((p.tamanoCustomMm?.hMm||50)*3.78)}
                  : TAMANHOS.find(t=>t.id===p.tamanoId)||TAMANHOS[0]
                const elems = resolverImagenes(p.elementos||[])
                return(
                  <div key={p.id} style={{background:C.surface,borderRadius:14,
                    border:`1px solid ${C.bord2}`,overflow:'hidden',transition:'border-color .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=C.purple}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.bord2}>
                    <div style={{background:'#fff',height:130,display:'flex',
                      alignItems:'center',justifyContent:'center',overflow:'hidden',
                      borderBottom:`1px solid ${C.bord2}`}}>
                      <div style={{transform:`scale(${Math.min(0.6,200/Math.max(tamObj.w||1,tamObj.h||1))})`,
                        transformOrigin:'center center',pointerEvents:'none'}}>
                        <PreviewEtiqueta
                          plantilla={{...p,bg:p.bgColor||'#fff',elementos:elems}}
                          tamano={tamObj}
                          producto={prodParaPreview}
                          scale={1}
                          tipoPrecioSel=""
                        />
                      </div>
                    </div>
                    <div style={{padding:'11px 13px'}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{p.nombre}</div>
                      <div style={{fontSize:10,color:C.hint,marginBottom:10}}>
                        {p.fecha} · {tamNom} · {elems.length} elem.
                      </div>
                      <div style={{display:'flex',gap:5}}>
                        <button onClick={()=>{setDisenoImpId(p.id);setTab('imprimir');setVista('editor')}}
                          style={{flex:1,padding:'7px 0',borderRadius:7,cursor:'pointer',
                            border:`1px solid ${C.blue}44`,background:C.blueD,color:C.blue,fontSize:11,fontWeight:700}}>
                          🖨 Imprimir
                        </button>
                        {puedeEditar?(
                          <button onClick={()=>{cargarPlantillaGuardada(p);setTab('editor');setVista('editor')}}
                            style={{flex:1,padding:'7px 0',borderRadius:7,cursor:'pointer',
                              border:`1px solid ${C.purple}44`,background:C.purpleD,color:C.purple,fontSize:11,fontWeight:700}}>
                            ✏️ Editar
                          </button>
                        ):(
                          <div style={{flex:1,padding:'7px 0',borderRadius:7,textAlign:'center',
                            fontSize:10,color:C.hint,border:`1px solid ${C.bord2}`,background:C.sur2}}>
                            🔒 Sin permiso
                          </div>
                        )}
                        {puedeEditar&&(
                          <button onClick={()=>{
                            if(!window.confirm('¿Eliminar "'+p.nombre+'"?'))return
                            eliminarPlantillaGuardada(p.id)
                          }}
                            style={{padding:'7px 9px',borderRadius:7,cursor:'pointer',
                              border:`1px solid ${C.bord2}`,background:C.sur2,color:C.hint,fontSize:12}}
                            onMouseEnter={e=>{e.currentTarget.style.color=C.red;e.currentTarget.style.borderColor=C.red}}
                            onMouseLeave={e=>{e.currentTarget.style.color=C.hint;e.currentTarget.style.borderColor=C.bord2}}>
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )

  return(
    <div style={{background:C.bg,minHeight:'100vh',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text,
      display:'flex',flexDirection:'column'}}>

      {/* Header editor/imprimir */}
      <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bord2}`,
        display:'flex',justifyContent:'space-between',alignItems:'center',
        background:C.surface,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>setVista('lista')}
            style={{padding:'6px 12px',borderRadius:8,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:12,fontWeight:600}}>
            ← Mis etiquetas
          </button>
          <h1 style={{margin:0,fontSize:16,fontWeight:800}}>
            {tab==='editor'
              ? (plantillaEditId&&nombreGuardar?`✏️ ${nombreGuardar}`:'✏️ Nuevo diseño')
              : '🖨 Imprimir etiquetas'}
          </h1>
        </div>
        <div style={{display:'flex',gap:7}}>
          {puedeEditar&&tab==='editor'&&(
            <button onClick={()=>{
              setPlantillaBase({...PLANTILLA_VACIA,elementos:[]})
              setBgColor('#ffffff')
              setPlantillaEditId(null)
              setNombreGuardar('')
              localStorage.removeItem('nexus_etiquetas_borrador')
            }} style={{padding:'7px 13px',borderRadius:8,cursor:'pointer',
                border:`1px solid ${C.bord2}`,background:'transparent',
                color:C.hint,fontSize:12,fontWeight:600}}>
              🗒 Nuevo
            </button>
          )}
          {puedeEditar&&(
            <button onClick={()=>setTab('editor')}
              style={{padding:'7px 16px',borderRadius:8,cursor:'pointer',
                border:`1px solid ${tab==='editor'?C.purple:C.bord2}`,
                background:tab==='editor'?C.purpleD:'transparent',
                color:tab==='editor'?C.purple:C.muted,fontSize:12,fontWeight:600}}>
              ✏️ Diseñar
            </button>
          )}
          <button onClick={()=>setTab('imprimir')}
            style={{padding:'7px 16px',borderRadius:8,cursor:'pointer',
              border:`1px solid ${tab==='imprimir'?C.blue:C.bord2}`,
              background:tab==='imprimir'?C.blueD:'transparent',
              color:tab==='imprimir'?C.blue:C.muted,fontSize:12,fontWeight:600}}>
            🖨 Imprimir
          </button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── TAB EDITOR ── */}
        {tab==='editor'&&(
          <div style={{display:'flex',flex:1,minHeight:0,overflow:'hidden',alignItems:'stretch'}}>

            {/* Panel izquierdo — configuración */}
            <div style={{width:240,background:C.surface,
              borderRight:`1px solid ${C.bord2}`,
              overflowY:'auto',flexShrink:0,padding:12}}>

            {/* Mis etiquetas guardadas */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,
                textTransform:'uppercase',marginBottom:8,
                display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>⭐ Mis etiquetas</span>
                <span style={{fontSize:10,color:C.hint,fontWeight:400}}>
                  {plantillasGuardadas.length} guardadas
                </span>
              </div>
              {/* Buscador */}
              <div style={{position:'relative',marginBottom:8}}>
                <span style={{position:'absolute',left:8,top:'50%',
                  transform:'translateY(-50%)',color:C.hint,fontSize:11}}>🔍</span>
                <input
                  value={busqPlantilla}
                  onChange={e=>setBusqPlantilla(e.target.value)}
                  placeholder="Buscar etiqueta..."
                  style={{...FI,paddingLeft:26,fontSize:11}}/>
              </div>
              {/* Lista filtrada */}
              {plantillasGuardadas
                .filter(p=>!busqPlantilla||p.nombre.toLowerCase().includes(busqPlantilla.toLowerCase()))
                .map(p=>(
                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:5,
                    marginBottom:5,background:C.sur2,borderRadius:7,padding:'7px 9px',
                    border:`1px solid ${C.bord2}`,cursor:'pointer',
                    transition:'border-color .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.bord2}>
                    <div style={{flex:1}} onClick={()=>cargarPlantillaGuardada(p)}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text}}>
                        📄 {p.nombre}
                      </div>
                      <div style={{fontSize:9,color:C.hint,marginTop:1}}>
                        {p.fecha} · {p.tamanoId||'—'}
                      </div>
                    </div>
                    <button onClick={()=>eliminarPlantillaGuardada(p.id)}
                      style={{background:'none',border:'none',cursor:'pointer',
                        color:C.hint,fontSize:15,padding:'2px 4px',flexShrink:0}}
                      onMouseEnter={e=>e.currentTarget.style.color=C.red}
                      onMouseLeave={e=>e.currentTarget.style.color=C.hint}>×</button>
                  </div>
                ))
              }
              {plantillasGuardadas.length===0&&(
                <div style={{padding:'14px 10px',textAlign:'center',
                  color:C.hint,fontSize:11,background:C.sur2,
                  borderRadius:8,border:`1px dashed ${C.bord2}`}}>
                  Guarda tu primer diseño con el botón de abajo
                </div>
              )}
            </div>

            {/* Tamaño */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,
                textTransform:'uppercase',marginBottom:8}}>
                Tamaño de papel
              </div>
              <select value={tamano.id}
                onChange={e=>setTamano(TAMANHOS.find(t=>t.id===e.target.value))}
                style={FI}>
                {TAMANHOS.map(t=>(
                  <option key={t.id} value={t.id}>{t.l} — {t.desc}</option>
                ))}
              </select>
              {tamano.id==='custom'&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:6}}>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2}}>Ancho (mm)</div>
                    <input type="number" min="10" max="300" value={tamanoCustomMm.wMm}
                      onChange={e=>setTamanoCustomMm(p=>({...p,wMm:parseInt(e.target.value)||80}))}
                      style={FI}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2}}>Alto (mm)</div>
                    <input type="number" min="10" max="300" value={tamanoCustomMm.hMm}
                      onChange={e=>setTamanoCustomMm(p=>({...p,hMm:parseInt(e.target.value)||50}))}
                      style={FI}/>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de precios */}
            {tiposPrecio.length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,
                  textTransform:'uppercase',marginBottom:6}}>
                  Lista de precios para {'{'}{'{'}'precio'{'}'}{'}'}
                </div>
                <select value={tipoPrecioSel}
                  onChange={e=>setTipoPrecioSel(e.target.value)}
                  style={{...FI,borderColor:tipoPrecioSel?C.green:C.bord2,
                    background:tipoPrecioSel?C.greenD:C.sur2}}>
                  <option value="">Precio por defecto (lista 1)</option>
                  {tiposPrecio.map(tp=>(
                    <option key={tp.id} value={tp.id}>{tp.nombre}</option>
                  ))}
                </select>
                {/* Info variables por lista */}
                <div style={{marginTop:6,padding:'6px 8px',borderRadius:6,
                  background:C.sur3,border:`1px solid ${C.bord2}`}}>
                  <div style={{fontSize:9,color:C.hint,marginBottom:3,fontWeight:600}}>
                    VARIABLES DISPONIBLES POR LISTA:
                  </div>
                  {tiposPrecio.slice(0,3).map((tp,i)=>(
                    <div key={tp.id} style={{fontSize:10,color:C.muted,
                      display:'flex',justifyContent:'space-between',marginBottom:1}}>
                      <code style={{color:C.amber}}>{`{{precio_${i+1}}}`}</code>
                      <span style={{color:C.hint}}>→ siempre {tp.nombre}</span>
                    </div>
                  ))}
                  <div style={{fontSize:10,color:C.muted,marginTop:3,
                    display:'flex',justifyContent:'space-between'}}>
                    <code style={{color:C.green}}>{`{{precio}}`}</code>
                    <span style={{color:C.hint}}>→ usa la lista seleccionada arriba</span>
                  </div>
                </div>
              </div>
            )}

            {/* Color de fondo */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,
                textTransform:'uppercase',marginBottom:6}}>
                Color de fondo
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="color" value={bgColor}
                  onChange={e=>setBgColor(e.target.value)}
                  style={{width:36,height:28,border:'none',cursor:'pointer',borderRadius:6}}/>
                <input value={bgColor} onChange={e=>setBgColor(e.target.value)}
                  style={{...FI,fontSize:12}}/>
              </div>
            </div>

            {/* Guardar plantilla */}
            <div style={{marginBottom:14}}>
              <button onClick={()=>setModalGuardar(true)}
                style={{width:'100%',padding:'9px',borderRadius:9,border:'none',
                  background:C.green,color:'white',cursor:'pointer',
                  fontSize:12,fontWeight:700,
                  boxShadow:'0 3px 10px rgba(16,185,129,.3)'}}>
                💾 Guardar diseño actual
              </button>
            </div>

            {/* Agregar elementos */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,
                textTransform:'uppercase',marginBottom:8}}>
                Agregar elemento
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5}}>
                {[['texto','📝 Texto'],['precio','💲 Precio'],['barcode','▌▌▌ Cód. Barras'],['rect','▬ Rectángulo'],['imagen','🖼 Imagen']].map(([t,l])=>(
                  <button key={t} onClick={()=>addElemento(t)}
                    style={{padding:'7px 4px',borderRadius:7,cursor:'pointer',fontSize:11,
                      border:`1px solid ${C.bord2}`,background:C.sur2,color:C.muted,
                      fontWeight:600,textAlign:'center'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            </div>

            {/* Panel central — canvas con zoom y scroll */}
            <div style={{flex:1,display:'flex',flexDirection:'column',
              minHeight:0,overflow:'hidden',background:'#0d1117'}}>

              {/* Barra de herramientas del canvas */}
              <div style={{display:'flex',alignItems:'center',gap:10,
                padding:'7px 14px',borderBottom:`1px solid #1F2937`,
                background:'#111827',flexShrink:0,flexWrap:'wrap'}}>
                <span style={{fontSize:10,color:C.hint}}>🖱 Arrastrar</span>
                <span style={{fontSize:10,color:C.hint}}>↔ Redimensionar</span>
                <span style={{fontSize:10,color:C.hint}}>🔄 Naranja=girar</span>
                <div style={{marginLeft:'auto',display:'flex',
                  alignItems:'center',gap:6}}>
                  {/* Zoom controls */}
                  <button onClick={()=>setZoom(z=>Math.max(0.2,+(z-0.1).toFixed(1)))}
                    style={{padding:'3px 8px',borderRadius:5,cursor:'pointer',
                      border:`1px solid ${C.bord2}`,background:C.sur2,
                      color:C.text,fontSize:13,fontWeight:700,lineHeight:1}}>−</button>
                  <span style={{fontSize:11,color:C.text,fontWeight:700,
                    minWidth:40,textAlign:'center'}}>
                    {Math.round(zoom*100)}%
                  </span>
                  <button onClick={()=>setZoom(z=>Math.min(3,+(z+0.1).toFixed(1)))}
                    style={{padding:'3px 8px',borderRadius:5,cursor:'pointer',
                      border:`1px solid ${C.bord2}`,background:C.sur2,
                      color:C.text,fontSize:13,fontWeight:700,lineHeight:1}}>+</button>
                  {/* Zoom presets */}
                  {[0.5,0.75,1,1.5,2].map(z=>(
                    <button key={z} onClick={()=>setZoom(z)}
                      style={{padding:'3px 7px',borderRadius:5,cursor:'pointer',
                        fontSize:10,fontWeight:zoom===z?800:400,
                        border:`1px solid ${zoom===z?C.blue:C.bord2}`,
                        background:zoom===z?C.blueD:C.sur2,
                        color:zoom===z?C.blue:C.hint}}>
                      {z===1?'100%':z===0.5?'50%':z===0.75?'75%':z===1.5?'150%':'200%'}
                    </button>
                  ))}
                  <button onClick={()=>{
                    // Ajustar zoom para que quepa en el panel
                    const panelW = 600, panelH = 500
                    const zW = (panelW-60)/tamanoActual.w
                    const zH = (panelH-60)/tamanoActual.h
                    setZoom(+Math.min(zW,zH,1).toFixed(2))
                  }}
                    style={{padding:'3px 8px',borderRadius:5,cursor:'pointer',
                      border:`1px solid ${C.bord2}`,background:C.sur2,
                      color:C.hint,fontSize:10}}>
                    Ajustar
                  </button>
                </div>
              </div>

              {/* Área de canvas con scroll */}
              <div style={{flex:1,overflow:'auto',display:'flex',
                alignItems:'flex-start',justifyContent:'center',
                padding:`${Math.max(20,60-tamanoActual.h*zoom*0.1)}px 20px`}}>
                <div style={{
                  transform:`scale(${zoom})`,
                  transformOrigin:'top center',
                  flexShrink:0,
                  // Espacio para que el scroll funcione con zoom grande
                  marginBottom: zoom>1 ? `${tamanoActual.h*(zoom-1)}px` : 0,
                  marginRight:  zoom>1 ? `${tamanoActual.w*(zoom-1)*0.5}px` : 0,
                }}>
                  <CanvasEditor
                    plantilla={plantillaConBg}
                    setPlantilla={updater=>{
                      setPlantillaBase(prev=>{
                        const next = typeof updater==='function'
                          ? updater({...prev, bg:bgColor})
                          : {...updater, bg:bgColor}
                        return {...next, elementos: next.elementos||prev.elementos}
                      })
                    }}
                    tamano={tamanoActual}
                    producto={prodParaPreview}
                    bgColor={bgColor}
                    tipoPrecioSel={tipoPrecioSel}
                    onSelChange={id=>setSelId(id!=null?String(id):null)}
                  />
                </div>
              </div>

              {/* Info pie */}
              <div style={{padding:'4px 14px',background:'#111827',
                borderTop:`1px solid #1F2937`,flexShrink:0,
                display:'flex',justifyContent:'space-between',
                fontSize:10,color:C.hint}}>
                <span>{tamanoActual.wMm}×{tamanoActual.hMm}mm ({tamanoActual.w}×{tamanoActual.h}px)</span>
                <span>Zoom: {Math.round(zoom*100)}%</span>
              </div>
            </div>

            {/* Panel derecho — elementos con scroll */}
            <div style={{width:260,background:C.surface,
                borderLeft:`1px solid ${C.bord2}`,
                overflowY:'auto',flexShrink:0,padding:12,
                alignSelf:'stretch',minHeight:0,
                display:'flex',flexDirection:'column'}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,
                textTransform:'uppercase',marginBottom:8,
                position:'sticky',top:0,background:C.surface,zIndex:5,
                paddingBottom:6,borderBottom:`1px solid ${C.bord2}`}}>
                Elementos ({plantilla.elementos?.length||0})
                {selId&&(
                  <span style={{fontSize:9,color:C.blue,fontWeight:400,marginLeft:6}}>
                    ● seleccionado
                  </span>
                )}
              </div>
              {plantilla.elementos?.length===0&&(
                <div style={{textAlign:'center',padding:'20px 8px',
                  color:C.hint,fontSize:11}}>
                  Agrega elementos desde el panel izquierdo
                </div>
              )}
              {/* Elemento SELECCIONADO primero — siempre visible al tope */}
              {plantilla.elementos?.map((el,idx)=>{
                const esSel = String(selId)===String(el.id??idx)
                if(!esSel) return null
                return(
                  <div key={'sel-'+el.id}
                    style={{borderRadius:8,marginBottom:6,
                      outline:`2px solid ${C.blue}`,outlineOffset:1,
                      background:'rgba(59,130,246,.05)'}}>
                    <div style={{fontSize:9,color:C.blue,fontWeight:700,
                      padding:'3px 8px 0',textTransform:'uppercase',
                      letterSpacing:'.05em'}}>
                      ● Editando
                    </div>
                    <EditorElemento el={el} idx={idx}
                      totalEls={plantilla.elementos.length}
                      onChange={nuevoEl=>updateElemento(idx,nuevoEl)}
                      onDelete={()=>deleteElemento(idx)}
                      onMover={dir=>moverCapa(idx,dir)}
                      producto={prodParaPreview}
                      tamano={tamanoActual}/>
                  </div>
                )
              })}
              {/* Separador */}
              {selId!=null&&plantilla.elementos?.length>1&&(
                <div style={{fontSize:9,color:C.hint,textTransform:'uppercase',
                  padding:'4px 4px 4px',borderTop:`1px solid ${C.bord2}`,
                  marginBottom:4,letterSpacing:'.05em'}}>
                  Otros elementos
                </div>
              )}
              {/* Resto de elementos */}
              {plantilla.elementos?.map((el,idx)=>{
                const esSel = String(selId)===String(el.id??idx)
                if(esSel) return null  // ya se mostró arriba
                return(
                  <div key={el.id||idx}
                    onClick={()=>setSelId(String(el.id??idx))}
                    style={{borderRadius:8,marginBottom:4,
                      outline:'2px solid transparent',
                      cursor:'pointer',opacity:0.75,
                      transition:'opacity .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                    onMouseLeave={e=>e.currentTarget.style.opacity='0.75'}>
                    {/* Cabecera compacta del elemento */}
                    <div style={{display:'flex',alignItems:'center',gap:6,
                      padding:'6px 8px',background:C.sur2,borderRadius:8,
                      fontSize:11,color:C.muted}}>
                      <span style={{fontSize:13}}>
                        {el.tipo==='imagen'?'🖼':el.tipo==='rect'?'▬':
                         el.tipo==='barcode'?'▌▌▌':'T'}
                      </span>
                      <span style={{fontWeight:600}}>
                        {el.tipo==='imagen'?'Imagen':
                         el.tipo==='rect'?'Rectángulo':
                         el.tipo==='barcode'?'Código barras':
                         (el.texto||'').replace(/\{\{|\}\}/g,'').slice(0,18)||el.tipo}
                      </span>
                      <span style={{marginLeft:'auto',fontSize:10,color:C.hint}}>
                        clic para editar
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        )}

        {/* ── TAB IMPRIMIR ── */}
        {tab==='imprimir'&&(
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>

            {/* Panel izquierdo — selección productos */}
            <div style={{width:310,background:C.surface,borderRight:`1px solid ${C.bord2}`,
              overflowY:'auto',padding:14,flexShrink:0}}>

              {/* Modo de selección */}
              <div style={{display:'flex',gap:3,marginBottom:12,
                background:C.sur2,borderRadius:8,padding:3}}>
                {[['buscar','🔍 Buscar'],['categoria','📂 Categoría'],['marca','🏷 Marca']].map(([v,l])=>(
                  <button key={v} onClick={()=>setModoFiltro(v)}
                    style={{flex:1,padding:'6px 4px',borderRadius:6,cursor:'pointer',
                      fontSize:10,fontWeight:modoFiltro===v?700:400,border:'none',
                      background:modoFiltro===v?C.blue:'transparent',
                      color:modoFiltro===v?'white':C.hint}}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Buscar individual */}
              {modoFiltro==='buscar'&&(
                <div style={{position:'relative',marginBottom:10}}>
                  <span style={{position:'absolute',left:9,top:'50%',
                    transform:'translateY(-50%)',color:C.hint}}>🔍</span>
                  <input value={busqueda} onChange={e=>buscarProductos(e.target.value)}
                    placeholder="Código o descripción..."
                    style={{...FI,paddingLeft:26}}/>
                  {busRes.length>0&&(
                    <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,
                      zIndex:900,background:C.surface,borderRadius:8,
                      border:`1px solid ${C.bord2}`,overflow:'hidden',
                      boxShadow:'0 8px 24px rgba(0,0,0,.5)',maxHeight:260,overflowY:'auto'}}>
                      {busRes.map(p=>(
                        <div key={p.id} onClick={()=>toggleProducto(p)}
                          style={{padding:'7px 10px',cursor:'pointer',fontSize:12,
                            borderBottom:`1px solid ${C.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <div style={{fontWeight:600,color:C.text,fontSize:12}}>{p.descripcion}</div>
                          <div style={{display:'flex',gap:8,marginTop:2}}>
                            <code style={{fontSize:10,color:C.purple}}>{p.codigo}</code>
                            {(p.precios||[]).map(pr=>{
                              const iva=Number(p.iva_porcentaje||0)
                              const pvp=Number(pr.precio_pvp||pr.precio*(1+iva/100)||pr.precio)
                              return(
                                <span key={pr.tipo_precio_id} style={{fontSize:10,color:C.green}}>
                                  {pr.tipo_nombre}: ${pvp.toFixed(2)}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Por categoría */}
              {modoFiltro==='categoria'&&(
                <div style={{marginBottom:10}}>
                  <select value={filtCatId}
                    onChange={e=>setFiltCatId(e.target.value)}
                    style={{...FI,marginBottom:6}}>
                    <option value="">-- Selecciona categoría --</option>
                    {categorias.map(cat=>(
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre} ({cat.num_productos} prod.)
                      </option>
                    ))}
                  </select>
                  <button onClick={()=>filtCatId&&cargarPorFiltro(filtCatId,null)}
                    disabled={!filtCatId||cargandoProd}
                    style={{width:'100%',padding:'8px',borderRadius:8,border:'none',
                      cursor:filtCatId?'pointer':'not-allowed',fontSize:12,fontWeight:700,
                      background:filtCatId&&!cargandoProd?C.blue:C.sur3,
                      color:filtCatId&&!cargandoProd?'white':C.hint}}>
                    {cargandoProd?'Cargando...':'📂 Cargar todos con stock'}
                  </button>
                </div>
              )}

              {/* Por marca */}
              {modoFiltro==='marca'&&(
                <div style={{marginBottom:10}}>
                  <select value={filtMarcaId}
                    onChange={e=>setFiltMarcaId(e.target.value)}
                    style={{...FI,marginBottom:6}}>
                    <option value="">-- Selecciona marca --</option>
                    {marcas.map(m=>(
                      <option key={m.id} value={m.id}>
                        {m.nombre} ({m.num_productos} prod.)
                      </option>
                    ))}
                  </select>
                  <button onClick={()=>filtMarcaId&&cargarPorFiltro(null,filtMarcaId)}
                    disabled={!filtMarcaId||cargandoProd}
                    style={{width:'100%',padding:'8px',borderRadius:8,border:'none',
                      cursor:filtMarcaId?'pointer':'not-allowed',fontSize:12,fontWeight:700,
                      background:filtMarcaId&&!cargandoProd?C.blue:C.sur3,
                      color:filtMarcaId&&!cargandoProd?'white':C.hint}}>
                    {cargandoProd?'Cargando...':'🏷 Cargar todos con stock'}
                  </button>
                </div>
              )}

              {/* Selector de diseño */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,
                  textTransform:'uppercase',marginBottom:6}}>
                  Diseño de etiqueta
                </div>
                <select value={disenoImpId||''}
                  onChange={e=>setDisenoImpId(e.target.value?parseInt(e.target.value):null)}
                  style={{...FI,borderColor:disenoImpId?C.green:C.blue,
                    background:disenoImpId?C.greenD:C.blueD}}>
                  <option value="">✏️ Diseño actual (editor)</option>
                  {plantillasGuardadas.map(p=>(
                    <option key={p.id} value={p.id}>
                      ⭐ {p.nombre} — {p.tamanoId||'custom'}
                    </option>
                  ))}
                </select>
                {disenoImpId&&plantillasGuardadas.find(x=>x.id===disenoImpId)&&(
                  <div style={{fontSize:10,color:C.green,marginTop:3}}>
                    {plantillasGuardadas.find(x=>x.id===disenoImpId)?.nombre}
                    {' · '}{plantillasGuardadas.find(x=>x.id===disenoImpId)?.fecha}
                  </div>
                )}
              </div>

              {/* Copias por producto */}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,color:C.muted,display:'block',
                  marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
                  Copias por producto
                </label>
                <input type="number" min="1" max="100" value={cantidad}
                  onChange={e=>setCantidad(parseInt(e.target.value)||1)}
                  style={{...FI,textAlign:'center',fontSize:16,fontWeight:700}}/>
              </div>

              {/* Productos seleccionados */}
              <div style={{display:'flex',justifyContent:'space-between',
                alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase'}}>
                  Seleccionados ({selProd.length})
                </div>
                {selProd.length>0&&(
                  <button onClick={quitarTodos}
                    style={{fontSize:10,background:'none',border:'none',
                      cursor:'pointer',color:C.hint,padding:0}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.red}
                    onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                    Quitar todos
                  </button>
                )}
              </div>
              {selProd.length===0&&(
                <div style={{padding:16,textAlign:'center',color:C.hint,fontSize:12,
                  background:C.sur2,borderRadius:8,border:`1px dashed ${C.bord2}`}}>
                  Busca y agrega productos
                </div>
              )}
              {selProd.map(p=>(
                <div key={p.id} style={{padding:'7px 9px',borderRadius:8,marginBottom:4,
                  background:C.sur2,border:`1px solid ${C.bord2}`,
                  display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:C.text,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {p.descripcion}
                    </div>
                    <div style={{display:'flex',gap:6,marginTop:2,flexWrap:'wrap'}}>
                      <code style={{fontSize:9,color:C.purple}}>{p.codigo}</code>
                      {/* Precio oferta si tiene */}
                      {p.tiene_oferta&&p.precio_oferta>0&&(
                        <span style={{fontSize:9,color:C.amber,fontWeight:700,
                          background:C.amberD,padding:'1px 5px',borderRadius:4}}>
                          🏷 Oferta: ${Number(p.precio_oferta).toFixed(2)}
                        </span>
                      )}
                      {/* Precios normales con IVA */}
                      {(p.precios||[]).map(pr=>{
                        const iva=Number(p.iva_porcentaje||0)
                        const pvp=Number(pr.precio_pvp||pr.precio*(1+iva/100)||pr.precio)
                        return(
                          <span key={pr.tipo_precio_id} style={{fontSize:9,
                            color:C.green,fontWeight:600}}>
                            {pr.tipo_nombre}: ${pvp.toFixed(2)}
                          </span>
                        )
                      })}
                      <span style={{fontSize:9,color:C.hint}}>
                        Stock: {Number(p.stock_total||0).toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <button onClick={()=>setSelProd(prev=>prev.filter(x=>x.id!==p.id))}
                    style={{background:'none',border:'none',cursor:'pointer',
                      color:C.hint,fontSize:16,flexShrink:0,marginLeft:4}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.red}
                    onMouseLeave={e=>e.currentTarget.style.color=C.hint}>×</button>
                </div>
              ))}

              {selProd.length>0&&(
                <button onClick={imprimirYMarcar}
                  style={{width:'100%',padding:'12px',marginTop:14,
                    borderRadius:10,border:'none',background:C.blue,
                    color:'white',cursor:'pointer',fontSize:14,fontWeight:800,
                    boxShadow:'0 4px 16px rgba(59,130,246,.4)'}}>
                  🖨 Imprimir {selProd.length * cantidad} etiquetas
                </button>
              )}
            </div>

            {/* Panel derecho — preview */}
            <div style={{flex:1,overflowY:'auto',padding:20,
              background:'#0A0F1E',display:'flex',flexDirection:'column',gap:0}}>

              {/* Info strip */}
              <div style={{display:'flex',justifyContent:'space-between',
                alignItems:'center',marginBottom:16,padding:'10px 14px',
                background:C.surface,borderRadius:10,border:`1px solid ${C.bord2}`}}>
                <div style={{fontSize:12,color:C.muted}}>
                  <span style={{color:C.text,fontWeight:700}}>{selProd.length}</span> producto{selProd.length!==1?'s':''}
                  {' × '}
                  <span style={{color:C.text,fontWeight:700}}>{cantidad}</span> cop.
                  {' = '}
                  <span style={{color:C.blue,fontWeight:800}}>{selProd.length*cantidad}</span> etiqueta{selProd.length*cantidad!==1?'s':''}
                </div>
                <div style={{fontSize:11,color:C.hint}}>
                  {tamanoImp.wMm}×{tamanoImp.hMm}mm
                  {disenoImpId&&plantillasGuardadas.find(x=>x.id===disenoImpId)&&(
                    <span style={{marginLeft:8,color:C.green,fontWeight:600}}>
                      · {plantillasGuardadas.find(x=>x.id===disenoImpId)?.nombre}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview etiquetas — máximo 12 en pantalla */}
              {selProd.length===0?(
                <div style={{width:'100%',textAlign:'center',padding:60,
                  color:C.hint,fontSize:14}}>
                  Agrega productos en el panel izquierdo para ver la vista previa
                </div>
              ):(
                <>
                  {/* Aviso si hay muchos */}
                  {selProd.length*cantidad > 12 && (
                    <div style={{padding:'8px 12px',marginBottom:10,borderRadius:8,
                      background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.25)',
                      fontSize:12,color:C.blue,display:'flex',
                      justifyContent:'space-between',alignItems:'center'}}>
                      <span>
                        Vista previa: primeras <strong>12</strong> de <strong>{selProd.length*cantidad}</strong> etiquetas.
                        Al imprimir saldrán todas.
                      </span>
                    </div>
                  )}
                  <div ref={printRef}
                    style={{display:'flex',flexWrap:'wrap',gap:6,
                      justifyContent:'flex-start',alignContent:'flex-start'}}>
                    {selProd.flatMap((p,pi)=>
                      Array.from({length:cantidad},(_,ci)=>{
                        const idx = pi*cantidad+ci
                        if(idx>=12) return null // solo 12 en preview
                        return(
                          <div key={`${p.id}-${ci}`}
                            style={{display:'inline-block',
                              border:`1px solid ${C.bord2}`,borderRadius:4,
                              overflow:'hidden'}}>
                            <PreviewEtiqueta
                              plantilla={plantillaImp}
                              tamano={tamanoImp}
                              producto={p}
                              scale={1}
                              tipoPrecioSel={tipoPrecioSel}
                            />
                          </div>
                        )
                      })
                    ).filter(Boolean)}
                  </div>
                  {selProd.length*cantidad > 12 && (
                    <div style={{textAlign:'center',padding:'16px 0 4px',
                      fontSize:12,color:C.hint}}>
                      + {selProd.length*cantidad - 12} etiquetas más · todas se imprimen al presionar el botón
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal guardar plantilla */}
      {modalGuardar&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:C.surface,borderRadius:14,padding:28,width:380,
            border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
            <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:16}}>
              💾 Guardar diseño
            </div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:6,fontWeight:600,textTransform:'uppercase'}}>
              Nombre de la plantilla *
            </label>
            <input value={nombreGuardar}
              onChange={e=>setNombreGuardar(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&guardarPlantilla()}
              placeholder="Ej: Etiqueta producto grande..."
              autoFocus
              style={{...FI,fontSize:14,marginBottom:8}}/>
            {plantillaEditId&&(
              <div style={{fontSize:10,color:C.amber,marginBottom:12}}>
                ⚠ Cambiar el nombre creará una nueva etiqueta en lugar de sobreescribir
              </div>
            )}
            {!plantillaEditId&&(
              <div style={{height:12,marginBottom:4}}/>
            )}
            <div style={{fontSize:11,color:C.hint,marginBottom:16}}>
              Tamaño: {tamanoActual.wMm}×{tamanoActual.hMm} mm ·{' '}
              {plantilla.elementos?.length||0} elementos
              {plantilla.elementos?.some(e=>e.tipo==='imagen'&&e.src?.startsWith('data:'))&&(
                <span style={{marginLeft:6,color:C.amber}}>
                  · ⚠ Contiene imágenes (se guardan separadas)
                </span>
              )}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalGuardar(false)}
                style={{padding:'8px 16px',borderRadius:8,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:13}}>
                Cancelar
              </button>
              <button onClick={guardarPlantilla}
                disabled={!nombreGuardar.trim()}
                style={{padding:'8px 20px',borderRadius:8,border:'none',
                  background:nombreGuardar.trim()?C.green:C.sur3,
                  color:nombreGuardar.trim()?'white':C.hint,
                  cursor:nombreGuardar.trim()?'pointer':'not-allowed',
                  fontSize:13,fontWeight:700}}>
                💾 Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}