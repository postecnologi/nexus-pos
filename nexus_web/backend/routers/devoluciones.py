from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api", tags=["Devoluciones"])


class DevDetalleIn(BaseModel):
    factura_det_id:  Optional[int] = None
    producto_id:     int
    bodega_id:       Optional[int] = None
    serie_id:        Optional[int] = None
    cantidad:        float
    precio_unitario: float
    iva_porcentaje:  float = 15.0
    estado_serie:    str   = "DEVUELTA"  # DEVUELTA, DISPONIBLE, DAÑADA

class DevolucionIn(BaseModel):
    factura_id:       int
    motivo:           str
    tipo_devolucion:  str   = "PARCIAL"   # TOTAL, PARCIAL
    forma_devolucion: str   = "EFECTIVO"  # EFECTIVO, TRANSFERENCIA, SALDO_FAVOR
    banco_origen:     Optional[str] = None
    banco_destino:    Optional[str] = None
    referencia_pago:  Optional[str] = None
    observaciones:    Optional[str] = None
    detalles:         list


@router.get("/facturas/{fid}/para-devolucion")
def factura_para_devolucion(fid: int, u=Depends(get_current_user)):
    """Devuelve la factura con sus detalles y series para hacer la devolucion"""
    f = query_one("""
        SELECT f.*,
               c.razon_social as cliente_nombre,
               c.identificacion as cliente_ruc,
               c.email as cliente_email
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id = f.cliente_id
        WHERE f.id=%s AND f.estado='EMITIDA'
    """, (fid,))
    if not f:
        raise HTTPException(404, "Factura no encontrada o ya anulada")

    # Bodega principal de la sucursal de la factura
    suc_factura = f.get("sucursal_id")
    bod_principal = None
    if suc_factura:
        bp = query_one("""
            SELECT id, nombre FROM inv_bodegas
            WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
        """, (suc_factura,))
        if bp: bod_principal = bp

    detalles = query("""
        SELECT fd.*,
               p.descripcion, p.codigo, p.aplica_series,
               COALESCE((
                   SELECT SUM(dd.cantidad)
                   FROM ven_devolucion_detalles dd
                   JOIN ven_devoluciones dv ON dv.id=dd.devolucion_id
                   WHERE dd.factura_detalle_id=fd.id
                     AND dv.estado='EMITIDA'
               ), 0) as cantidad_devuelta
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id = fd.producto_id
        WHERE fd.factura_id=%s
    """, (fid,))

    # Inyectar bodega_id en cada detalle
    for det in detalles:
        det["bodega_id"]     = bod_principal["id"]   if bod_principal else None
        det["bodega_nombre"] = bod_principal["nombre"] if bod_principal else None

    # Series vendidas por cada detalle
    for det in detalles:
        if det.get("aplica_series"):
            det["series"] = query("""
                SELECT s.id, s.serie, s.estado, s.bodega_id,
                       b.nombre as bodega
                FROM inv_series s
                LEFT JOIN inv_bodegas b ON b.id = s.bodega_id
                WHERE s.factura_id=%s AND s.producto_id=%s
                  AND s.estado='VENDIDA'
            """, (fid, det["producto_id"]))
        else:
            det["series"] = []

    f["detalles"] = detalles
    return f


@router.get("/devoluciones")
def get_devoluciones(
    busqueda: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds = ["1=1"]
    params = []
    if busqueda:
        conds.append("(c.razon_social ILIKE %s OR d.numero ILIKE %s OR f.numero_factura ILIKE %s)")
        params += [f"%{busqueda}%"]*3
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT d.*,
               d.numero as numero_nc,
               DATE(d.fecha) as fecha_emision,
               c.razon_social as cliente_nombre,
               f.numero_factura,
               f.total as factura_total
        FROM ven_devoluciones d
        JOIN ven_clientes c  ON c.id = d.cliente_id
        JOIN ven_facturas f  ON f.id = d.factura_id
        {where}
        ORDER BY d.fecha DESC, d.id DESC
        LIMIT 200
    """, params)


@router.post("/devoluciones")
def crear_devolucion(dev: DevolucionIn, u=Depends(get_current_user)):
    if not dev.detalles:
        raise HTTPException(400, "Debe incluir al menos un producto a devolver")

    factura = query_one(
        "SELECT * FROM ven_facturas WHERE id=%s AND estado='EMITIDA'",
        (dev.factura_id,))
    if not factura:
        raise HTTPException(404, "Factura no encontrada o ya anulada")

    suc_id = factura.get("sucursal_id") or u.get("sucursal_id")
    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,)) if suc_id else None
    if not suc:
        suc = query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada")

    seq      = int(suc.get("secuencial_nc") or 1)
    cod_est  = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    num_nc   = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"

    emp     = query_one("SELECT iva_porcentaje FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct = float(emp["iva_porcentaje"]) if emp else 15.0

    sub0 = subiva = 0.0
    for det in dev.detalles:
        pu   = float(det["precio_unitario"])
        cant = float(det["cantidad"])
        iv   = float(det.get("iva_porcentaje", iva_pct))
        lin  = round(cant * pu, 2)
        if iv == 0: sub0  += lin
        else:       subiva += lin

    iva_monto = round(subiva * iva_pct / 100, 2)
    total     = round(sub0 + subiva + iva_monto, 2)

    dev_id = insert("""
        INSERT INTO ven_devoluciones
            (numero, factura_id, cliente_id, sucursal_id, usuario_id,
             fecha, tipo, motivo, subtotal_0, subtotal_iva, iva, total,
             estado, tipo_accion, observaciones,
             doc_modificado_num, doc_modificado_fecha, razon_modificacion)
        VALUES (%s,%s,%s,%s,%s,NOW(),%s,%s,%s,%s,%s,%s,'EMITIDA','DEVOLUCION_DINERO',%s,%s,CURRENT_DATE,%s)
    """, (
        num_nc, dev.factura_id, factura["cliente_id"],
        suc_id, u["id"],
        dev.tipo_devolucion, dev.motivo,
        round(sub0,2), round(subiva,2), iva_monto, total,
        dev.observaciones,
        factura.get("numero_factura"), dev.motivo
    ))

    for det in dev.detalles:
        pu       = float(det["precio_unitario"])
        cant     = float(det["cantidad"])
        iv       = float(det.get("iva_porcentaje", iva_pct))
        lin      = round(cant * pu, 2)
        iva_l    = round(lin * iv / 100, 2) if iv > 0 else 0.0
        serie_id = det.get("serie_id")
        est_ser  = det.get("estado_serie", "DEVUELTA")

        # Bodega destino para reversar stock — usa la del frontend o la principal
        bod_id = det.get("bodega_id")
        if not bod_id:
            bod = query_one("""
                SELECT id FROM inv_bodegas
                WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
            """, (suc_id,))
            bod_id = bod["id"] if bod else None

        insert("""
            INSERT INTO ven_devolucion_detalles
                (devolucion_id, factura_detalle_id, producto_id,
                 serie_id, cantidad, precio_unitario, subtotal,
                 iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (dev_id, det.get("factura_det_id"), det["producto_id"],
              serie_id, cant, pu, lin, iv, iva_l, round(lin+iva_l,2)))

        # Reversar stock
        if bod_id:
            try:
                execute("""
                    UPDATE inv_stock SET cantidad = cantidad + %s
                    WHERE producto_id=%s AND bodega_id=%s
                """, (cant, det["producto_id"], bod_id))
            except: pass

        # Actualizar serie
        if serie_id:
            try:
                execute("""
                    UPDATE inv_series SET estado=%s, factura_id=NULL WHERE id=%s
                """, (est_ser.upper(), serie_id))
            except: pass

    # Saldo a favor -> abonar CXC
    if dev.forma_devolucion == "SALDO_FAVOR":
        try:
            cxc = query_one("""
                SELECT id, saldo FROM fin_cxc
                WHERE cliente_id=%s AND saldo>0
                ORDER BY fecha_vencimiento ASC LIMIT 1
            """, (factura["cliente_id"],))
            if cxc:
                nuevo_saldo = max(0, float(cxc["saldo"]) - total)
                execute("UPDATE fin_cxc SET saldo=%s WHERE id=%s", (nuevo_saldo, cxc["id"]))
        except: pass

    execute("""
        UPDATE sys_sucursales SET secuencial_nc = secuencial_nc + 1 WHERE id=%s
    """, (suc_id,))

    # Generar clave de acceso SRI para NC (tipo 04)
    clave_acceso = ""
    try:
        emp_sri = query_one("SELECT ruc, ambiente_sri FROM sys_empresas WHERE activa=true LIMIT 1")
        ruc_emp = (emp_sri.get("ruc") or "9999999999999") if emp_sri else "9999999999999"
        amb     = (emp_sri.get("ambiente_sri") or "1") if emp_sri else "1"
        fecha_e = date.today().strftime("%d%m%Y")
        tipo_c  = "04"  # 04 = Nota de Crédito
        serie6  = f"{cod_est.replace('-','')}{pto_emis.replace('-','')}"[:6].zfill(6)
        seq9    = str(seq).zfill(9)
        cod_num = str(dev_id).zfill(8)[-8:]
        tipo_em = "1"
        clave48 = f"{fecha_e}{tipo_c}{ruc_emp}{amb}{serie6}{seq9}{cod_num}{tipo_em}"
        factores = [2,3,4,5,6,7]*8
        suma = sum(int(c)*f for c,f in zip(reversed(clave48), factores))
        r = 11 - (suma % 11)
        dv = 0 if r == 11 else (1 if r == 10 else r)
        clave_acceso = clave48 + str(dv)
        execute(
            "UPDATE ven_devoluciones SET clave_acceso=%s WHERE id=%s",
            (clave_acceso, dev_id))
    except Exception as e:
        print(f"Error generando clave SRI para NC: {e}")

    return {"id": dev_id, "numero_nc": num_nc, "total": total,
            "clave_acceso": clave_acceso,
            "msg": "Nota de credito emitida correctamente"}


@router.get("/devoluciones/{dev_id}/detalle")
def detalle_devolucion(dev_id: int, u=Depends(get_current_user)):
    d = query_one("""
        SELECT d.*,
               c.razon_social as cliente_nombre,
               c.identificacion as cliente_ruc,
               f.numero_factura,
               s.nombre as sucursal_nombre,
               emp.razon_social as empresa_nombre,
               emp.ruc as empresa_ruc,
               emp.logo_base64
        FROM ven_devoluciones d
        JOIN ven_clientes c    ON c.id = d.cliente_id
        JOIN ven_facturas f    ON f.id = d.factura_id
        LEFT JOIN sys_sucursales s ON s.id = d.sucursal_id
        LEFT JOIN sys_empresas emp ON emp.activa=true
        WHERE d.id=%s
    """, (dev_id,))
    if not d: raise HTTPException(404)
    d["detalles"] = query("""
        SELECT dd.*, p.descripcion, p.codigo,
               s.serie, b.nombre as bodega_nombre
        FROM ven_devolucion_detalles dd
        JOIN inv_productos p     ON p.id = dd.producto_id
        LEFT JOIN inv_series s   ON s.id = dd.serie_id
        WHERE dd.devolucion_id=%s
    """, (dev_id,))
    return d
