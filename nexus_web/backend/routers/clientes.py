from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])


class ClienteIn(BaseModel):
    tipo_identificacion:     str = "RUC"
    identificacion:          str
    razon_social:            str
    nombres:                 Optional[str] = None
    apellidos:               Optional[str] = None
    telefono:                Optional[str] = None
    email:                   Optional[str] = None
    direccion:               Optional[str] = None
    ciudad:                  Optional[str] = None
    provincia:               Optional[str] = None
    pais:                    Optional[str] = "Ecuador"
    codigo_pais:             Optional[str] = "593"
    direccion_matriz:        Optional[str] = None
    tipo_contribuyente:      Optional[str] = "NATURAL"
    obligado_contabilidad:   bool = False
    contribuyente_especial:  Optional[str] = None
    tipo_precio_id:          Optional[int] = None
    vendedor_id:             Optional[int] = None
    limite_credito:          float = 0
    plazo_pago:              int = 0
    activo:                  bool = True


@router.get("")
def get_clientes(
    busqueda: str = "",
    activo: Optional[str] = "true",
    u=Depends(get_current_user)
):
    conds = []; params = []
    if activo == "true":    conds.append("c.activo=true")
    elif activo == "false": conds.append("c.activo=false")
    if busqueda:
        conds.append("(c.razon_social ILIKE %s OR c.identificacion ILIKE %s OR c.telefono ILIKE %s OR c.email ILIKE %s)")
        params += [f"%{busqueda}%"]*4
    where = "WHERE " + " AND ".join(conds) if conds else ""
    return query(f"""
        SELECT c.*,
               tp.nombre as tipo_precio_nombre,
               v.nombre  as vendedor_nombre
        FROM ven_clientes c
        LEFT JOIN inv_tipos_precio tp ON tp.id=c.tipo_precio_id
        LEFT JOIN ven_vendedores   v  ON v.id=c.vendedor_id
        {where}
        ORDER BY c.razon_social LIMIT 200
    """, params)


@router.get("/{cid}/saldo-favor")
def get_saldo_favor(cid: int, u=Depends(get_current_user)):
    rows = query("SELECT * FROM fin_saldos_favor WHERE cliente_id=%s AND saldo > 0 ORDER BY fecha", (cid,))
    total = sum(float(r['saldo']) for r in rows)
    return {"cliente_id": cid, "total_saldo": round(total, 2), "detalle": rows}


@router.get("/{cid}")
def get_cliente(cid: int, u=Depends(get_current_user)):
    c = query_one("""
        SELECT c.*, tp.nombre as tipo_precio_nombre,
               v.nombre as vendedor_nombre
        FROM ven_clientes c
        LEFT JOIN inv_tipos_precio tp ON tp.id=c.tipo_precio_id
        LEFT JOIN ven_vendedores   v  ON v.id=c.vendedor_id
        WHERE c.id=%s
    """, (cid,))
    if not c: raise HTTPException(404, "Cliente no encontrado")
    c["facturas"] = query("""
        SELECT f.id, f.numero_factura, f.fecha_emision,
               f.total, f.estado
        FROM ven_facturas f
        WHERE f.cliente_id=%s AND f.estado='EMITIDA'
        ORDER BY f.fecha_emision DESC LIMIT 20
    """, (cid,))
    c["cxc"] = query("""
        SELECT cx.*, f.numero_factura
        FROM fin_cxc cx
        LEFT JOIN ven_facturas f ON f.id=cx.factura_id
        WHERE cx.cliente_id=%s AND cx.saldo>0
        ORDER BY cx.fecha_vencimiento
    """, (cid,))
    return c


@router.post("")
def crear_cliente(c: ClienteIn, u=Depends(get_current_user)):
    existe = query_one(
        "SELECT id FROM ven_clientes WHERE identificacion=%s", (c.identificacion,))
    if existe: raise HTTPException(400, "Ya existe un cliente con esa identificación")
    cid = insert("""
        INSERT INTO ven_clientes
        (tipo_identificacion, identificacion, razon_social, nombres, apellidos,
         telefono, email, direccion, ciudad, provincia, pais, codigo_pais,
         direccion_matriz, tipo_contribuyente, obligado_contabilidad,
         contribuyente_especial, tipo_precio_id, vendedor_id,
         limite_credito, plazo_pago, activo, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP)
    """, (c.tipo_identificacion, c.identificacion, c.razon_social,
          c.nombres, c.apellidos, c.telefono, c.email,
          c.direccion, c.ciudad, c.provincia, c.pais, c.codigo_pais,
          c.direccion_matriz, c.tipo_contribuyente, c.obligado_contabilidad,
          c.contribuyente_especial, c.tipo_precio_id, c.vendedor_id,
          c.limite_credito, c.plazo_pago, c.activo))
    return {"id": cid, "msg": "Cliente creado"}


@router.put("/{cid}")
def actualizar_cliente(cid: int, c: ClienteIn, u=Depends(get_current_user)):
    existe = query_one(
        "SELECT id FROM ven_clientes WHERE identificacion=%s AND id!=%s",
        (c.identificacion, cid))
    if existe: raise HTTPException(400, "Ya existe otro cliente con esa identificación")
    execute("""
        UPDATE ven_clientes SET
            tipo_identificacion=%s, identificacion=%s, razon_social=%s,
            nombres=%s, apellidos=%s, telefono=%s, email=%s,
            direccion=%s, ciudad=%s, provincia=%s, pais=%s, codigo_pais=%s,
            direccion_matriz=%s, tipo_contribuyente=%s, obligado_contabilidad=%s,
            contribuyente_especial=%s, tipo_precio_id=%s, vendedor_id=%s,
            limite_credito=%s, plazo_pago=%s, activo=%s
        WHERE id=%s
    """, (c.tipo_identificacion, c.identificacion, c.razon_social,
          c.nombres, c.apellidos, c.telefono, c.email,
          c.direccion, c.ciudad, c.provincia, c.pais, c.codigo_pais,
          c.direccion_matriz, c.tipo_contribuyente, c.obligado_contabilidad,
          c.contribuyente_especial, c.tipo_precio_id, c.vendedor_id,
          c.limite_credito, c.plazo_pago, c.activo, cid))
    return {"msg": "Cliente actualizado"}


@router.patch("/{cid}/toggle")
def toggle_cliente(cid: int, u=Depends(get_current_user)):
    c = query_one("SELECT activo FROM ven_clientes WHERE id=%s", (cid,))
    if not c: raise HTTPException(404, "No encontrado")
    execute("UPDATE ven_clientes SET activo=%s WHERE id=%s", (not c["activo"], cid))
    return {"activo": not c["activo"]}
