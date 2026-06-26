"""
Router Guias de Remision — Documento electronico tipo 06 Ecuador
Guias de remision para transporte de mercaderia.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/guias-remision", tags=["Guias Remision"])


# -- Modelos --
class GuiaDetalleIn(BaseModel):
    producto_id: Optional[int] = None
    descripcion: str
    cantidad: float = 1


class GuiaRemisionIn(BaseModel):
    factura_id: Optional[int] = None
    cliente_id: int
    fecha_inicio_transporte: Optional[str] = None
    fecha_fin_transporte: Optional[str] = None
    transportista_ruc: Optional[str] = None
    transportista_razon: Optional[str] = None
    placa: Optional[str] = None
    ruta: Optional[str] = None
    dir_partida: Optional[str] = None
    dir_destino: Optional[str] = None
    motivo: str = "Venta"
    detalles: list  # List of GuiaDetalleIn dicts


# -- 1. Listar guias --
@router.get("")
def get_guias(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    cliente_id: Optional[int] = None,
    busqueda: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds = ["1=1"]
    params = []

    suc_id = u.get("sucursal_id")
    if suc_id:
        conds.append("g.sucursal_id=%s")
        params.append(suc_id)

    if fecha_ini:
        conds.append("g.fecha_emision >= %s")
        params.append(fecha_ini)
    if fecha_fin:
        conds.append("g.fecha_emision <= %s")
        params.append(fecha_fin)
    if cliente_id:
        conds.append("g.cliente_id = %s")
        params.append(cliente_id)
    if busqueda:
        conds.append("(c.razon_social ILIKE %s OR g.numero ILIKE %s OR g.transportista_razon ILIKE %s)")
        params += [f"%{busqueda}%"] * 3

    where = "WHERE " + " AND ".join(conds)

    return query(f"""
        SELECT g.*,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               f.numero_factura
        FROM ven_guias_remision g
        LEFT JOIN ven_clientes c ON c.id = g.cliente_id
        LEFT JOIN ven_facturas f ON f.id = g.factura_id
        {where}
        ORDER BY g.fecha_emision DESC, g.id DESC
        LIMIT 200
    """, params)


# -- 2. Proximo numero --
@router.get("/proximo-numero")
def proximo_numero(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        return {"numero": "001-001-000000001", "secuencial": 1}
    seq = int(suc.get("secuencial_guia_remision") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    return {
        "numero": f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}",
        "secuencial": seq,
    }


# -- 3. Crear guia de remision --
@router.post("/")
def crear_guia(body: GuiaRemisionIn, u=Depends(get_current_user)):
    if not body.detalles:
        raise HTTPException(400, "Debe incluir al menos un detalle")

    cliente = query_one("SELECT * FROM ven_clientes WHERE id=%s", (body.cliente_id,))
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")

    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada")

    suc_id = suc["id"]
    seq = int(suc.get("secuencial_guia_remision") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    numero = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"

    # Generar clave de acceso SRI (tipo 06)
    clave_acceso = None
    emp = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    if emp:
        try:
            ruc_emp = emp.get("ruc") or "9999999999999"
            amb = emp.get("ambiente_sri") or "1"
            fecha_e = date.today().strftime("%d%m%Y")
            tipo_c = "06"  # Guia de remision
            serie6 = f"{cod_est}{pto_emis}"[:6].zfill(6)
            seq9 = str(seq).zfill(9)
            cod_num = str(seq).zfill(8)[-8:]
            tipo_em = "1"
            clave48 = f"{fecha_e}{tipo_c}{ruc_emp}{amb}{serie6}{seq9}{cod_num}{tipo_em}"
            factores = [2, 3, 4, 5, 6, 7] * 8
            suma = sum(int(c) * f for c, f in zip(reversed(clave48), factores))
            r = 11 - (suma % 11)
            dv = 0 if r == 11 else (1 if r == 10 else r)
            clave_acceso = clave48 + str(dv)
        except Exception as e:
            print(f"Error generando clave SRI para guia: {e}")

    guia_id = insert("""
        INSERT INTO ven_guias_remision
            (numero, factura_id, cliente_id, sucursal_id, usuario_id,
             fecha_emision, fecha_inicio_transporte, fecha_fin_transporte,
             transportista_ruc, transportista_razon, placa, ruta,
             dir_partida, dir_destino, motivo,
             estado, estado_sri, clave_acceso)
        VALUES (%s, %s, %s, %s, %s, CURRENT_DATE, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                'EMITIDA', 'NO_ENVIADA', %s)
    """, (
        numero, body.factura_id, body.cliente_id, suc_id, u["id"],
        body.fecha_inicio_transporte, body.fecha_fin_transporte,
        body.transportista_ruc, body.transportista_razon,
        body.placa, body.ruta, body.dir_partida, body.dir_destino,
        body.motivo, clave_acceso,
    ))

    # Insertar detalles
    for d in body.detalles:
        det = d if isinstance(d, dict) else d.dict()
        insert("""
            INSERT INTO ven_guia_remision_detalles
                (guia_id, producto_id, descripcion, cantidad)
            VALUES (%s, %s, %s, %s)
        """, (
            guia_id, det.get("producto_id"), det.get("descripcion", ""),
            det.get("cantidad", 1),
        ))

    # Incrementar secuencial
    execute("UPDATE sys_sucursales SET secuencial_guia_remision = %s WHERE id = %s",
            (seq + 1, suc_id))

    return {
        "id": guia_id,
        "numero": numero,
        "clave_acceso": clave_acceso,
        "msg": "Guia de remision emitida correctamente",
    }


# -- 4. Detalle --
@router.get("/{gid}")
def get_guia(gid: int, u=Depends(get_current_user)):
    g = query_one("""
        SELECT g.*,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               f.numero_factura,
               emp.razon_social AS empresa_nombre,
               emp.ruc AS empresa_ruc,
               emp.direccion AS empresa_dir
        FROM ven_guias_remision g
        LEFT JOIN ven_clientes c ON c.id = g.cliente_id
        LEFT JOIN ven_facturas f ON f.id = g.factura_id
        LEFT JOIN sys_empresas emp ON emp.activa = true
        WHERE g.id = %s
    """, (gid,))
    if not g:
        raise HTTPException(404, "Guia de remision no encontrada")

    g["detalles"] = query("""
        SELECT gd.*, p.codigo, p.descripcion AS prod_descripcion
        FROM ven_guia_remision_detalles gd
        LEFT JOIN inv_productos p ON p.id = gd.producto_id
        WHERE gd.guia_id = %s ORDER BY gd.id
    """, (gid,))

    return g


# -- 5. Anular --
@router.patch("/{gid}/anular")
def anular_guia(gid: int, u=Depends(get_current_user)):
    g = query_one("SELECT estado, numero FROM ven_guias_remision WHERE id=%s", (gid,))
    if not g:
        raise HTTPException(404, "Guia de remision no encontrada")
    if g["estado"] == "ANULADA":
        raise HTTPException(400, "La guia de remision ya esta anulada")
    execute("UPDATE ven_guias_remision SET estado='ANULADA' WHERE id=%s", (gid,))
    return {"msg": "Guia de remision anulada correctamente"}
