from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api", tags=["Facturas"])


# ── Pydantic Models ─────────────────────────────────────────

class PagoIn(BaseModel):
    forma_pago:  str   # EFECTIVO,TARJETA,TRANSFERENCIA,MEDIANET,DEUNA,CREDITO
    monto:       float
    referencia:  Optional[str] = None
    banco_tarjeta:     Optional[str] = None
    banco_origen:      Optional[str] = None
    banco_destino:     Optional[str] = None
    cuenta_bancaria_id:Optional[int] = None   # cuenta bancaria nuestra

class FacturaIn(BaseModel):
    cliente_id:           int
    vendedor_id:          Optional[int] = None
    sucursal_id:          Optional[int] = None
    observaciones:        Optional[str] = None
    notas_internas:       Optional[str] = None
    descuento_global_pct: float = 0
    detalles:             list
    pagos:                list

class AnulacionIn(BaseModel):
    motivo: str


# ══════════════════════════════════════════════════════════════
#  FACTURACION
# ══════════════════════════════════════════════════════════════

@router.post("/facturas")
def crear_factura(f: FacturaIn, u=Depends(get_current_user)):
    if not f.detalles:
        raise HTTPException(400, "La factura debe tener al menos un producto")
    # Validate plan limits
    from database import get_current_db
    from multitenant import verificar_limite
    ok, msg = verificar_limite(get_current_db(), 'facturas')
    if not ok:
        raise HTTPException(403, msg)
    suc_id = f.sucursal_id or u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada.")

    seq         = int(suc.get("secuencial_factura") or 1)
    cod_est     = suc.get("codigo_establecimiento") or "001"
    pto_emis    = suc.get("punto_emision")          or "001"

    # Buscar el siguiente numero disponible (evitar duplicados)
    while True:
        num_factura = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"
        existe = query_one(
            "SELECT id FROM ven_facturas WHERE numero_factura=%s AND sucursal_id=%s",
            (num_factura, suc_id)
        )
        if not existe:
            break
        seq += 1

    emp     = query_one("SELECT iva_porcentaje FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct = float(emp["iva_porcentaje"]) if emp else 15.0

    subtotal_0 = subtotal_base = iva_monto_total = 0.0
    for det in f.detalles:
        pu   = float(det["precio_unitario"])   # precio CON IVA
        cant = float(det["cantidad"])
        dp   = float(det.get("descuento_pct", 0))
        dg   = float(f.descuento_global_pct)
        iv   = float(det.get("iva_porcentaje", iva_pct))
        # Total de la linea con IVA incluido
        linea_pvp = round(cant * pu * (1-dp/100) * (1-dg/100), 4)
        if iv == 0:
            subtotal_0    += linea_pvp
        else:
            # Extraer base sin IVA
            base   = round(linea_pvp / (1 + iv/100), 4)
            iva_l  = round(linea_pvp - base, 4)
            subtotal_base      += base
            iva_monto_total    += iva_l

    total        = round(subtotal_0 + subtotal_base + iva_monto_total, 2)
    subtotal_0   = round(subtotal_0,        2)
    subtotal_iva = round(subtotal_base,     2)
    iva_monto    = round(iva_monto_total,   2)

    # Obtener bodega principal de la sucursal para registrar en la factura
    bod_principal = query_one("""
        SELECT id FROM inv_bodegas
        WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
    """, (suc_id,))
    bod_fac_id = bod_principal["id"] if bod_principal else (
        query_one("SELECT id FROM inv_bodegas WHERE activa=true LIMIT 1") or {}
    ).get("id")

    fac_id = insert("""
        INSERT INTO ven_facturas
            (numero_factura, cliente_id, vendedor_id, sucursal_id, bodega_id,
             fecha_emision, subtotal_0, subtotal_iva, iva, total,
             descuento_global_pct, observaciones, estado, usuario_id, created_at)
        VALUES (%s,%s,%s,%s,%s,CURRENT_DATE,%s,%s,%s,%s,%s,%s,'EMITIDA',%s,NOW())
    """, (num_factura, f.cliente_id, f.vendedor_id, suc_id, bod_fac_id,
          subtotal_0, subtotal_iva, iva_monto, total,
          f.descuento_global_pct, f.observaciones, u["id"]))

    # Incrementar secuencial para la proxima factura
    execute(
        "UPDATE sys_sucursales SET secuencial_factura=%s WHERE id=%s",
        (seq + 1, suc_id)
    )

    # Generar clave de acceso SRI (49 digitos)
    try:
        from datetime import date
        emp_sri = query_one("SELECT ruc, ambiente_sri FROM sys_empresas WHERE activa=true LIMIT 1")
        ruc_emp = (emp_sri.get("ruc") or "9999999999999") if emp_sri else "9999999999999"
        amb     = (emp_sri.get("ambiente_sri") or "1") if emp_sri else "1"
        fecha_e = date.today().strftime("%d%m%Y")       # ddMMaaaa
        tipo_c  = "01"                                   # 01=factura
        cod_est_c = cod_est.replace("-","")
        pto_em_c  = pto_emis.replace("-","")
        serie6  = f"{cod_est_c}{pto_em_c}"[:6].zfill(6)
        seq9    = str(seq).zfill(9)
        cod_num = str(fac_id).zfill(8)[-8:]             # 8 digitos numericos
        tipo_em = "1"                                    # 1=emision normal
        clave48 = f"{fecha_e}{tipo_c}{ruc_emp}{amb}{serie6}{seq9}{cod_num}{tipo_em}"
        # Digito verificador modulo 11
        factores = [2,3,4,5,6,7]*8
        suma = sum(int(c)*f for c,f in zip(reversed(clave48), factores))
        r = 11 - (suma % 11)
        dv = 0 if r == 11 else (1 if r == 10 else r)
        clave_acceso = clave48 + str(dv)
        # Guardar en la factura
        execute(
            "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS clave_acceso VARCHAR(49)",
            ()
        )
        execute(
            "UPDATE ven_facturas SET clave_acceso=%s WHERE id=%s",
            (clave_acceso, fac_id)
        )
    except Exception as e:
        clave_acceso = ""
        print(f"Error generando clave SRI: {e}")

    for det in f.detalles:
        pu     = float(det["precio_unitario"])   # precio CON IVA
        cant   = float(det["cantidad"])
        dp     = float(det.get("descuento_pct", 0))
        dg     = float(f.descuento_global_pct)
        iv     = float(det.get("iva_porcentaje", iva_pct))
        linea_pvp = round(cant * pu * (1-dp/100) * (1-dg/100), 2)
        if iv > 0:
            base_l  = round(linea_pvp / (1 + iv/100), 2)
            iva_l   = round(linea_pvp - base_l, 2)
        else:
            base_l  = linea_pvp
            iva_l   = 0.0
        bod_id = det.get("bodega_id") or None

        insert("""
            INSERT INTO ven_factura_detalles
                (factura_id, producto_id, descripcion, cantidad,
                 precio_unitario, descuento, subtotal,
                 iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (fac_id, det["producto_id"], det.get("descripcion",""),
              cant, pu, dp, base_l, iv, iva_l, linea_pvp))

        # Generar movimiento bancario se hace en el loop de pagos (abajo)

        if bod_id:
            try:
                execute("UPDATE inv_stock SET cantidad=cantidad-%s WHERE producto_id=%s AND bodega_id=%s",
                        (cant, det["producto_id"], bod_id))
            except: pass
        else:
            try:
                bod = query_one("""
                    SELECT id FROM inv_bodegas
                    WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
                """, (suc_id,))
                if bod:
                    execute("UPDATE inv_stock SET cantidad=cantidad-%s WHERE producto_id=%s AND bodega_id=%s",
                            (cant, det["producto_id"], bod["id"]))
            except: pass


        # Registrar serie si viene en el detalle
        serie_id = det.get("serie_id")
        if serie_id:
            try:
                execute("""
                    UPDATE inv_series SET estado='VENDIDA', factura_id=%s WHERE id=%s
                """, (fac_id, serie_id))
                try:
                    insert("INSERT INTO ven_factura_series (factura_id, serie_id) VALUES (%s,%s)",
                           (fac_id, serie_id))
                except Exception:
                    pass
            except Exception:
                pass
    for pago in f.pagos:
        insert("""
            INSERT INTO ven_pagos
                (factura_id, forma_pago, monto, referencia,
                 banco_tarjeta, banco_origen, banco_destino, fecha, cuenta_bancaria_id,
                 pendiente_deposito)
            VALUES (%s,%s,%s,%s,%s,%s,%s,CURRENT_DATE,%s,%s)
        """, (fac_id, pago["forma_pago"], pago["monto"],
              pago.get("referencia"), pago.get("banco_tarjeta"),
              pago.get("banco_origen"), pago.get("banco_destino"),
              pago.get("cuenta_bancaria_id"),
              pago["forma_pago"] != "CREDITO"))

        # Movimiento bancario automatico si tiene cuenta y no es efectivo/credito
        cta_id_pago = pago.get("cuenta_bancaria_id")
        forma_pago  = pago["forma_pago"]
        if cta_id_pago and forma_pago not in ("EFECTIVO","CREDITO"):
            tipo_mov = "LOTE_TARJETA" if forma_pago=="TARJETA" else "TRANSFERENCIA_RECIBIDA"
            try:
                insert("""
                    INSERT INTO fin_movimientos_bancarios
                        (cuenta_id, tipo, concepto, monto, fecha, referencia,
                         estado, usuario_id)
                    VALUES (%s,%s,%s,%s,CURRENT_DATE,%s,'CONFIRMADO',%s)
                """, (cta_id_pago, tipo_mov,
                      f"Factura {numero} - {forma_pago}",
                      float(pago["monto"]), pago.get("referencia"), u["id"]))
                execute("UPDATE fin_cuentas_bancarias SET saldo_actual=saldo_actual+%s WHERE id=%s",
                        (float(pago["monto"]), cta_id_pago))
                execute("UPDATE ven_pagos SET pendiente_deposito=false WHERE factura_id=%s AND forma_pago=%s AND monto=%s",
                        (fac_id, forma_pago, pago["monto"]))
            except: pass

        if pago["forma_pago"] == "CREDITO":
            cli = query_one("SELECT plazo_pago FROM ven_clientes WHERE id=%s", (f.cliente_id,))
            plazo = int(cli["plazo_pago"]) if cli else 30
            try:
                insert("""
                    INSERT INTO fin_cxc
                        (factura_id, cliente_id, fecha_emision,
                         fecha_vencimiento, monto, saldo, estado)
                    VALUES (%s,%s,CURRENT_DATE,
                            CURRENT_DATE + (%s || ' days')::INTERVAL,
                            %s,%s,'PENDIENTE')
                """, (fac_id, f.cliente_id, plazo, pago["monto"], pago["monto"]))
            except: pass

    return {"id": fac_id, "numero_factura": num_factura, "total": total,
            "msg": "Factura emitida correctamente"}


@router.get("/facturas")
def get_facturas_lista(
    fecha_ini:  Optional[str] = None,
    fecha_fin:  Optional[str] = None,
    cliente_id: Optional[int] = None,
    busqueda:   Optional[str] = None,
    u=Depends(get_current_user)
):
    conds  = ["f.estado='EMITIDA'"]
    params = []
    if fecha_ini:  conds.append("f.fecha_emision>=%s"); params.append(fecha_ini)
    if fecha_fin:  conds.append("f.fecha_emision<=%s"); params.append(fecha_fin)
    if cliente_id: conds.append("f.cliente_id=%s");     params.append(cliente_id)
    if busqueda:
        conds.append("(c.razon_social ILIKE %s OR c.identificacion ILIKE %s OR f.numero_factura ILIKE %s)")
        params += [f"%{busqueda}%"]*3
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT f.*, c.razon_social as cliente_nombre,
               c.identificacion as cliente_ruc,
               v.nombre as vendedor_nombre
        FROM ven_facturas f
        JOIN ven_clientes c        ON c.id=f.cliente_id
        LEFT JOIN ven_vendedores v ON v.id=f.vendedor_id
        {where} ORDER BY f.fecha_emision DESC, f.id DESC LIMIT 100
    """, params)


@router.get("/facturas/{fid}/detalle")
def detalle_factura(fid: int, u=Depends(get_current_user)):
    f = query_one("""
        SELECT f.*,
               c.razon_social as cliente_nombre, c.identificacion as cliente_ruc,
               c.tipo_identificacion, c.direccion as cliente_dir, c.email as cliente_email,
               v.nombre as vendedor_nombre,
               s.nombre as sucursal_nombre, s.codigo_establecimiento, s.punto_emision,
               emp.razon_social as empresa_nombre, emp.ruc as empresa_ruc,
               emp.direccion as empresa_dir, emp.iva_porcentaje, emp.ambiente_sri,
               emp.logo_base64
        FROM ven_facturas f
        JOIN ven_clientes c        ON c.id=f.cliente_id
        LEFT JOIN ven_vendedores v ON v.id=f.vendedor_id
        LEFT JOIN sys_sucursales s ON s.id=f.sucursal_id
        LEFT JOIN sys_empresas emp ON emp.activa=true
        WHERE f.id=%s LIMIT 1
    """, (fid,))
    if not f: raise HTTPException(404, "Factura no encontrada")
    detalles = query("""
        SELECT fd.*, p.descripcion, p.codigo, p.aplica_series
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id=fd.producto_id
        WHERE fd.factura_id=%s
        ORDER BY fd.id
    """, (fid,))
    # Agregar series vendidas por cada detalle
    for det in detalles:
        series = query("""
            SELECT s.serie
            FROM inv_series s
            WHERE s.factura_id = %s
              AND s.producto_id = %s
            ORDER BY s.serie
        """, (fid, det["producto_id"]))
        det["series"] = [s["serie"] for s in series]
    f["detalles"] = detalles
    f["pagos"] = query("SELECT * FROM ven_pagos WHERE factura_id=%s", (fid,))
    return f


@router.post("/facturas/regenerar-claves")
def regenerar_claves_sri(u=Depends(get_current_user)):
    """Regenera la clave de acceso SRI para todas las facturas que no la tienen"""
    emp_sri = query_one("SELECT ruc, ambiente_sri FROM sys_empresas WHERE activa=true LIMIT 1")
    if not emp_sri:
        raise HTTPException(400, "No hay empresa configurada")
    ruc_emp = emp_sri.get("ruc") or "9999999999999"
    amb     = emp_sri.get("ambiente_sri") or "1"

    facturas = query("""
        SELECT f.id, f.numero_factura, f.fecha_emision
        FROM ven_facturas f
        WHERE f.clave_acceso IS NULL OR f.clave_acceso = ''
        ORDER BY f.id
    """)

    actualizadas = 0
    for f in facturas:
        try:
            num = f["numero_factura"]  # ej: 001-001-000000077
            partes = num.split("-")
            cod_est  = partes[0] if len(partes)>0 else "001"
            pto_emis = partes[1] if len(partes)>1 else "001"
            seq      = partes[2] if len(partes)>2 else "000000001"
            fecha_e  = f["fecha_emision"].strftime("%d%m%Y") if hasattr(f["fecha_emision"],'strftime') else str(f["fecha_emision"])[:10].replace("-","")
            # Reordenar ddmmyyyy
            if len(fecha_e)==8 and "-" not in fecha_e:
                pass  # ya esta en ddmmyyyy
            serie6   = f"{cod_est}{pto_emis}"[:6].zfill(6)
            seq9     = seq.zfill(9)
            cod_num  = str(f["id"]).zfill(8)[-8:]
            clave48  = f"{fecha_e}01{ruc_emp.zfill(13)}{amb}{serie6}{seq9}{cod_num}1"
            # Modulo 11
            factores = [2,3,4,5,6,7]*8
            suma = sum(int(c)*fc for c,fc in zip(reversed(clave48), factores))
            r = 11 - (suma % 11)
            dv = 0 if r==11 else (1 if r==10 else r)
            clave_acceso = clave48 + str(dv)
            execute("UPDATE ven_facturas SET clave_acceso=%s WHERE id=%s", (clave_acceso, f["id"]))
            actualizadas += 1
        except Exception as e:
            print(f"Error factura {f['id']}: {e}")

    return {"actualizadas": actualizadas, "msg": f"{actualizadas} facturas actualizadas"}


# ══════════════════════════════════════════════════════════════
#  ANULACION SRI
# ══════════════════════════════════════════════════════════════

@router.patch("/facturas/{fid}/anular")
def anular_factura_sri(fid: int, body: AnulacionIn, u=Depends(get_current_user)):
    """
    Anulacion de factura con registro SRI.
    En Ecuador solo se permite anular facturas NO enviadas al SRI.
    Para facturas ya autorizadas se debe emitir Nota de Credito.
    """
    f = query_one("""
        SELECT f.estado, f.sucursal_id, f.numero_factura, f.clave_acceso,
               f.total, f.cliente_id, f.fecha_emision
        FROM ven_facturas f WHERE f.id=%s
    """, (fid,))
    if not f:
        raise HTTPException(404, "Factura no encontrada")
    if f["estado"] == "ANULADA":
        raise HTTPException(400, "La factura ya esta anulada")
    if f.get("estado_sri") == "AUTORIZADA":
        raise HTTPException(400,
            "No se puede anular una factura AUTORIZADA por el SRI. "
            "Debe emitir una Nota de Credito desde el modulo Devoluciones.")

    # Marcar como anulada con motivo y fecha
    execute("""
        UPDATE ven_facturas
        SET estado='ANULADA', motivo_anulacion=%s,
            fecha_anulacion=NOW(), anulado_por=%s
        WHERE id=%s
    """, (body.motivo, u["id"], fid))

    # Reversar stock
    detalles = query("""
        SELECT producto_id, cantidad FROM ven_factura_detalles
        WHERE factura_id=%s
    """, (fid,))
    bod = query_one("""
        SELECT id FROM inv_bodegas
        WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
    """, (f["sucursal_id"],)) if f["sucursal_id"] else None
    if bod:
        for d in detalles:
            try:
                execute("""
                    UPDATE inv_stock SET cantidad=cantidad+%s
                    WHERE producto_id=%s AND bodega_id=%s
                """, (d["cantidad"], d["producto_id"], bod["id"]))
            except:
                pass

    # Reversar series vendidas
    try:
        execute("""
            UPDATE inv_series SET estado='DISPONIBLE', factura_id=NULL
            WHERE factura_id=%s AND estado='VENDIDA'
        """, (fid,))
    except:
        pass

    # Anular CXC asociada
    try:
        execute("""
            UPDATE fin_cxc SET estado='ANULADA', saldo=0
            WHERE factura_id=%s
        """, (fid,))
    except:
        pass

    # Anular pagos bancarios asociados
    try:
        execute("""
            UPDATE fin_movimientos_bancarios SET estado='ANULADO'
            WHERE id IN (
                SELECT cuenta_bancaria_id FROM ven_pagos
                WHERE factura_id=%s AND cuenta_bancaria_id IS NOT NULL
            )
        """, (fid,))
    except:
        pass

    return {
        "msg": "Factura anulada correctamente",
        "numero_factura": f["numero_factura"],
        "motivo": body.motivo,
        "stock_reversado": True,
        "cxc_anulada": True,
    }


# ══════════════════════════════════════════════════════════════
#  PROXIMO NUMERO
# ══════════════════════════════════════════════════════════════

@router.get("/facturas-proximo-numero")
def proximo_numero_factura(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        return {"numero": "001-001-000000001", "secuencial": 1}
    seq      = int(suc.get("secuencial_factura") or 1)
    cod_est  = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision")          or "001"
    return {
        "numero":     f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}",
        "secuencial": seq,
        "cod_est":    cod_est,
        "pto_emis":   pto_emis,
    }


# ══════════════════════════════════════════════════════════════
#  REIMPRIMIR
# ══════════════════════════════════════════════════════════════

@router.get("/reimprimir/buscar")
def buscar_facturas_reimprimir(
    q: Optional[str] = None,
    fecha: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds  = ["f.estado='EMITIDA'"]
    params = []
    if q:
        conds.append("(f.numero_factura ILIKE %s OR c.razon_social ILIKE %s OR c.identificacion ILIKE %s)")
        params += [f"%{q}%", f"%{q}%", f"%{q}%"]
    if fecha:
        conds.append("f.fecha_emision=%s"); params.append(fecha)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT f.id, f.numero_factura, f.fecha_emision,
               f.total, f.subtotal_0, f.subtotal_iva, f.iva, f.estado,
               c.razon_social as cliente_nombre,
               c.identificacion as cliente_ruc,
               v.nombre as vendedor_nombre
        FROM ven_facturas f
        JOIN ven_clientes c        ON c.id=f.cliente_id
        LEFT JOIN ven_vendedores v ON v.id=f.vendedor_id
        {where}
        ORDER BY f.fecha_emision DESC, f.id DESC LIMIT 50
    """, params)


# ══════════════════════════════════════════════════════════════
#  REPORTES VENTAS
# ══════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════
#  VALIDAR STOCK FACTURA
# ══════════════════════════════════════════════════════════════

def _get_stock_combo(pid: int, bodega_id: int):
    """Calcula el stock disponible de un combo basado en sus componentes (inline)"""
    componentes = query("""
        SELECT pc.componente_id, pc.cantidad as cant_requerida,
               p.descripcion, p.codigo,
               COALESCE(s.cantidad, 0) as stock_disponible,
               b.nombre as bodega
        FROM inv_producto_componentes pc
        JOIN inv_productos p ON p.id=pc.componente_id
        LEFT JOIN inv_stock s ON s.producto_id=pc.componente_id
            AND s.bodega_id=%s
        LEFT JOIN inv_bodegas b ON b.id=s.bodega_id
        WHERE pc.producto_id=%s
    """, (bodega_id or 1, pid))

    if not componentes:
        return {"es_combo": False, "stock_disponible": 0, "componentes": []}

    detalles = []
    for c in componentes:
        cant_req  = float(c["cant_requerida"])
        cant_disp = float(c["stock_disponible"])
        stock_combo = int(cant_disp / cant_req) if cant_req > 0 else 0
        detalles.append({
            **c,
            "stock_combo": stock_combo,
            "alcanza": cant_disp >= cant_req,
        })

    # Stock del combo = minimo de lo que alcanza para cada componente
    stock_total = min(d["stock_combo"] for d in detalles) if detalles else 0
    faltantes   = [d for d in detalles if not d["alcanza"]]

    return {
        "es_combo":        True,
        "stock_disponible": stock_total,
        "componentes":     detalles,
        "tiene_faltantes": len(faltantes) > 0,
        "faltantes":       faltantes,
    }


@router.post("/inventario/validar-stock")
def validar_stock_factura(items: list, bodega_id: int = 1, u=Depends(get_current_user)):
    """
    Valida si hay stock suficiente para todos los items de una factura.
    items: [{ producto_id, cantidad }]
    Retorna: { valido, errores }
    """
    errores = []
    for item in items:
        pid  = item["producto_id"]
        cant = float(item["cantidad"])
        prod = query_one("SELECT tipo_producto, descripcion FROM inv_productos WHERE id=%s", (pid,))
        if not prod: continue

        if prod.get("tipo_producto") == "COMBO":
            # Validar cada componente
            data = _get_stock_combo(pid, bodega_id)
            if data["tiene_faltantes"]:
                for f in data["faltantes"]:
                    errores.append({
                        "producto":  prod["descripcion"],
                        "componente": f["descripcion"],
                        "requerido":  float(f["cant_requerida"]) * cant,
                        "disponible": float(f["stock_disponible"]),
                        "bodega":     f.get("bodega", "—"),
                    })
            elif data["stock_disponible"] < cant:
                errores.append({
                    "producto":   prod["descripcion"],
                    "componente": "COMBO COMPLETO",
                    "requerido":  cant,
                    "disponible": data["stock_disponible"],
                    "bodega":     "—",
                })
        else:
            # Producto simple
            stock = query_one("""
                SELECT COALESCE(cantidad, 0) as cantidad
                FROM inv_stock WHERE producto_id=%s AND bodega_id=%s
            """, (pid, bodega_id))
            disp = float(stock["cantidad"]) if stock else 0
            if disp < cant:
                errores.append({
                    "producto":   prod["descripcion"],
                    "componente": None,
                    "requerido":  cant,
                    "disponible": disp,
                    "bodega":     "—",
                })

    return {"valido": len(errores) == 0, "errores": errores}


# ══════════════════════════════════════════════════════════════
#  TICKET TÉRMICO 80mm
# ══════════════════════════════════════════════════════════════

@router.get("/facturas/{fid}/ticket")
def ticket_factura(fid: int, u=Depends(get_current_user)):
    """Generates a POS ticket (text format) for thermal 80mm printers."""
    f = query_one("""
        SELECT f.*, c.razon_social as cli_nombre, c.identificacion as cli_ruc,
               emp.razon_social as emp_nombre, emp.ruc as emp_ruc,
               emp.direccion as emp_dir, emp.iva_porcentaje,
               s.nombre as suc_nombre, s.direccion as suc_dir
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id=f.cliente_id
        LEFT JOIN sys_empresas emp ON emp.activa=true
        LEFT JOIN sys_sucursales s ON s.id=f.sucursal_id
        WHERE f.id=%s
    """, (fid,))
    if not f:
        raise HTTPException(404, "Factura no encontrada")

    detalles = query("""
        SELECT fd.*, p.codigo, p.descripcion
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id=fd.producto_id
        WHERE fd.factura_id=%s ORDER BY fd.id
    """, (fid,))

    pagos = query("SELECT * FROM ven_pagos WHERE factura_id=%s", (fid,))

    W = 42  # chars width for 80mm
    lines = []

    # Helpers
    def center(text):
        return text.center(W)

    def line():
        return '=' * W

    def dash():
        return '-' * W

    def lr(left, right):
        return f"{left}{right.rjust(W - len(left))}"

    # Header
    lines.append(center(f.get('emp_nombre', '')[:W]))
    lines.append(center(f"RUC: {f.get('emp_ruc', '')}"))
    if f.get('suc_dir'):
        lines.append(center(f.get('suc_dir', '')[:W]))
    lines.append(line())

    # Invoice info
    lines.append(center('FACTURA'))
    lines.append(center(f.get('numero_factura', '')))
    fecha = str(f.get('fecha_emision', ''))[:10]
    lines.append(lr('Fecha:', fecha))
    lines.append(dash())

    # Client
    lines.append(lr('Cliente:', f.get('cli_nombre', '')[:26]))
    lines.append(lr('RUC/CI:', f.get('cli_ruc', '')))
    lines.append(dash())

    # Details header
    lines.append(lr('CANT  DESCRIPCION', 'TOTAL'))
    lines.append(dash())

    for d in detalles:
        desc = d.get('descripcion', '')[:28]
        cant = f"{float(d.get('cantidad', 1)):.0f}"
        total_det = f"${float(d.get('total', 0)):.2f}"
        lines.append(f"{cant:>4}  {desc}")
        pu = f"  @${float(d.get('precio_unitario', 0)):.2f}"
        lines.append(lr(pu, total_det))

    lines.append(dash())

    # Totals
    sub0 = float(f.get('subtotal_0', 0))
    sub_iva = float(f.get('subtotal_iva', 0))
    iva_val = float(f.get('iva', 0))
    total_val = float(f.get('total', 0))
    iva_pct = int(float(f.get('iva_porcentaje', 15)))

    if sub0 > 0:
        lines.append(lr('Subtotal 0%:', f'${sub0:.2f}'))
    lines.append(lr(f'Subtotal {iva_pct}%:', f'${sub_iva:.2f}'))
    lines.append(lr(f'IVA {iva_pct}%:', f'${iva_val:.2f}'))
    lines.append(line())
    lines.append(lr('TOTAL:', f'${total_val:.2f}'))
    lines.append(line())

    # Payments
    for p in pagos:
        lines.append(lr(f"  {p.get('forma_pago', '')}:", f"${float(p.get('monto', 0)):.2f}"))

    lines.append('')

    # Clave acceso
    clave = f.get('clave_acceso', '')
    if clave:
        lines.append(center('CLAVE DE ACCESO'))
        for i in range(0, len(clave), W):
            lines.append(center(clave[i:i + W]))

    lines.append('')
    lines.append(center('GRACIAS POR SU COMPRA'))
    lines.append('')

    ticket_text = '\n'.join(lines)
    return Response(
        content=ticket_text,
        media_type="text/plain",
        headers={"Content-Disposition": f"inline; filename=ticket_{f.get('numero_factura', '')}.txt"}
    )


# ══════════════════════════════════════════════════════════════
#  BORRADORES
# ══════════════════════════════════════════════════════════════

@router.get("/facturas/borradores")
def get_borradores(u=Depends(get_current_user)):
    return query("""
        SELECT f.*, c.razon_social as cliente_nombre
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id=f.cliente_id
        WHERE f.estado='BORRADOR'
        ORDER BY f.created_at DESC
    """)


@router.delete("/facturas/{fid}")
def eliminar_borrador(fid: int, u=Depends(get_current_user)):
    """Delete a draft invoice. Only BORRADOR can be deleted."""
    f = query_one("SELECT estado FROM ven_facturas WHERE id=%s", (fid,))
    if not f: raise HTTPException(404, "Factura no encontrada")
    if f["estado"] != "BORRADOR":
        raise HTTPException(400, "Solo se pueden eliminar borradores")
    execute("DELETE FROM ven_factura_detalles WHERE factura_id=%s", (fid,))
    execute("DELETE FROM ven_facturas WHERE id=%s", (fid,))
    return {"msg": "Borrador eliminado"}

@router.post("/facturas/borrador")
def crear_borrador(f: FacturaIn, u=Depends(get_current_user)):
    """Save invoice as draft without emitting (no stock deduction, no SRI)."""
    if not f.detalles:
        raise HTTPException(400, "La factura debe tener al menos un producto")
    suc_id = f.sucursal_id or u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada")

    emp = query_one("SELECT iva_porcentaje FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct = float(emp["iva_porcentaje"]) if emp else 15.0

    subtotal_0 = subtotal_base = iva_monto_total = 0.0
    for det in f.detalles:
        pu = float(det["precio_unitario"])
        cant = float(det["cantidad"])
        dp = float(det.get("descuento_pct", 0))
        dg = float(f.descuento_global_pct)
        iv = float(det.get("iva_porcentaje", iva_pct))
        linea_pvp = round(cant * pu * (1-dp/100) * (1-dg/100), 4)
        if iv == 0:
            subtotal_0 += linea_pvp
        else:
            base = round(linea_pvp / (1 + iv/100), 4)
            iva_l = round(linea_pvp - base, 4)
            subtotal_base += base
            iva_monto_total += iva_l

    total_val = round(subtotal_0 + subtotal_base + iva_monto_total, 2)

    bod_principal = query_one("""
        SELECT id FROM inv_bodegas WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
    """, (suc_id,))
    bod_id = bod_principal["id"] if bod_principal else (
        query_one("SELECT id FROM inv_bodegas WHERE activa=true LIMIT 1") or {}
    ).get("id")

    import uuid
    borrador_num = f"BOR-{uuid.uuid4().hex[:8].upper()}"
    fac_id = insert("""
        INSERT INTO ven_facturas
            (numero_factura, cliente_id, vendedor_id, sucursal_id, bodega_id,
             fecha_emision, subtotal_0, subtotal_iva, iva, total,
             descuento_global_pct, observaciones, notas_internas, estado, usuario_id, created_at)
        VALUES (%s,%s,%s,%s,%s,CURRENT_DATE,%s,%s,%s,%s,%s,%s,%s,'BORRADOR',%s,NOW())
    """, (borrador_num, f.cliente_id, f.vendedor_id, suc_id, bod_id,
          round(subtotal_0, 2), round(subtotal_base, 2), round(iva_monto_total, 2), total_val,
          f.descuento_global_pct, f.observaciones, getattr(f, 'notas_internas', None), u["id"]))

    for det in f.detalles:
        pu = float(det["precio_unitario"])
        cant = float(det["cantidad"])
        dp = float(det.get("descuento_pct", 0))
        dg = float(f.descuento_global_pct)
        iv = float(det.get("iva_porcentaje", iva_pct))
        linea_pvp = round(cant * pu * (1-dp/100) * (1-dg/100), 2)
        if iv > 0:
            base_l = round(linea_pvp / (1 + iv/100), 2)
            iva_l = round(linea_pvp - base_l, 2)
        else:
            base_l = linea_pvp
            iva_l = 0.0

        insert("""INSERT INTO ven_factura_detalles
            (factura_id, producto_id, descripcion, cantidad,
             precio_unitario, descuento, subtotal, iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (fac_id, det["producto_id"], det.get("descripcion", ""), cant,
             pu, dp, base_l, iv, iva_l, linea_pvp))

    return {"id": fac_id, "msg": "Borrador guardado", "estado": "BORRADOR"}


@router.post("/facturas/{fid}/emitir-borrador")
def emitir_borrador(fid: int, u=Depends(get_current_user)):
    """Convert a draft to an emitted invoice (assigns number, deducts stock, generates SRI key)."""
    f = query_one("SELECT * FROM ven_facturas WHERE id=%s AND estado='BORRADOR'", (fid,))
    if not f:
        raise HTTPException(400, "La factura no es borrador o no existe")

    suc_id = f.get('sucursal_id')
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true LIMIT 1")
    )
    seq = int(suc.get("secuencial_factura") or 1) if suc else 1
    cod_est = suc.get("codigo_establecimiento") or "001" if suc else "001"
    pto_emis = suc.get("punto_emision") or "001" if suc else "001"

    # Find next available number (avoid duplicates)
    while True:
        num_factura = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"
        existe = query_one(
            "SELECT id FROM ven_facturas WHERE numero_factura=%s AND sucursal_id=%s",
            (num_factura, suc_id)
        )
        if not existe:
            break
        seq += 1

    execute("UPDATE ven_facturas SET numero_factura=%s, estado='EMITIDA', fecha_emision=CURRENT_DATE WHERE id=%s",
            (num_factura, fid))
    execute("UPDATE sys_sucursales SET secuencial_factura=%s WHERE id=%s", (seq + 1, suc_id))

    # Deduct stock
    detalles = query("SELECT producto_id, cantidad FROM ven_factura_detalles WHERE factura_id=%s", (fid,))
    bod = query_one("""
        SELECT id FROM inv_bodegas
        WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
    """, (suc_id,)) if suc_id else None
    if bod:
        for d in detalles:
            try:
                execute("UPDATE inv_stock SET cantidad=cantidad-%s WHERE producto_id=%s AND bodega_id=%s",
                        (d['cantidad'], d['producto_id'], bod['id']))
            except:
                pass

    # Generate SRI key
    try:
        emp = query_one("SELECT ruc, ambiente_sri FROM sys_empresas WHERE activa=true LIMIT 1")
        ruc = emp.get('ruc', '9999999999999') if emp else '9999999999999'
        amb = emp.get('ambiente_sri', '1') if emp else '1'
        fecha_e = date.today().strftime("%d%m%Y")
        serie6 = f"{cod_est}{pto_emis}"[:6].zfill(6)
        clave48 = f"{fecha_e}01{ruc}{amb}{serie6}{str(seq).zfill(9)}{str(fid).zfill(8)[-8:]}1"
        factores = [2, 3, 4, 5, 6, 7] * 8
        suma = sum(int(c) * fc for c, fc in zip(reversed(clave48), factores))
        r = 11 - (suma % 11)
        dv = 0 if r == 11 else (1 if r == 10 else r)
        execute("UPDATE ven_facturas SET clave_acceso=%s WHERE id=%s", (clave48 + str(dv), fid))
    except:
        pass

    return {"id": fid, "numero_factura": num_factura, "msg": "Borrador emitido como factura"}


# ══════════════════════════════════════════════════════════════
#  DUPLICAR FACTURA
# ══════════════════════════════════════════════════════════════

@router.post("/facturas/{fid}/duplicar")
def duplicar_factura(fid: int, u=Depends(get_current_user)):
    """Duplicate an invoice as a new draft."""
    f = query_one("SELECT * FROM ven_facturas WHERE id=%s", (fid,))
    if not f:
        raise HTTPException(404, "Factura no encontrada")

    import uuid
    borrador_num = f"BOR-{uuid.uuid4().hex[:8].upper()}"
    new_id = insert("""
        INSERT INTO ven_facturas
            (numero_factura, cliente_id, vendedor_id, sucursal_id, bodega_id,
             fecha_emision, subtotal_0, subtotal_iva, iva, total,
             descuento_global_pct, observaciones, estado, usuario_id, created_at)
        VALUES (%s,%s,%s,%s,%s,CURRENT_DATE,%s,%s,%s,%s,%s,%s,'BORRADOR',%s,NOW())
    """, (borrador_num, f['cliente_id'], f.get('vendedor_id'), f.get('sucursal_id'), f.get('bodega_id'),
          f['subtotal_0'], f['subtotal_iva'], f['iva'], f['total'],
          f.get('descuento_global_pct', 0), f.get('observaciones'), u['id']))

    detalles = query("SELECT * FROM ven_factura_detalles WHERE factura_id=%s", (fid,))
    for d in detalles:
        insert("""INSERT INTO ven_factura_detalles
            (factura_id, producto_id, descripcion, cantidad,
             precio_unitario, descuento, subtotal, iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (new_id, d['producto_id'], d.get('descripcion', ''), d['cantidad'],
             d['precio_unitario'], d.get('descuento', 0), d.get('subtotal', 0),
             d.get('iva_porcentaje', 15), d.get('iva_valor', 0), d.get('total', 0)))

    return {"id": new_id, "msg": "Factura duplicada como borrador"}


# ══════════════════════════════════════════════════════════════
#  PRECIO CLIENTE (auto-descuento por tipo de precio)
# ══════════════════════════════════════════════════════════════

@router.get("/facturas/precio-cliente/{cid}")
def precio_cliente(cid: int, u=Depends(get_current_user)):
    """Get client's price type for auto-discount."""
    cliente = query_one("SELECT tipo_precio_id FROM ven_clientes WHERE id=%s", (cid,))
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")
    return {"tipo_precio_id": cliente.get('tipo_precio_id', 1)}


# ══════════════════════════════════════════════════════════════
#  DESCUENTO POR VOLUMEN
# ══════════════════════════════════════════════════════════════

@router.get("/facturas/descuento-volumen/{producto_id}")
def descuento_volumen(producto_id: int, cantidad: float = 1, u=Depends(get_current_user)):
    """Suggest volume discount based on quantity."""
    descuento = 0
    if cantidad >= 100:
        descuento = 10
    elif cantidad >= 50:
        descuento = 7
    elif cantidad >= 25:
        descuento = 5
    elif cantidad >= 10:
        descuento = 3
    elif cantidad >= 5:
        descuento = 1
    return {"producto_id": producto_id, "cantidad": cantidad, "descuento_sugerido": descuento}


# ══════════════════════════════════════════════════════════════
#  FACTURAS RECURRENTES
# ══════════════════════════════════════════════════════════════

@router.get("/facturas/recurrentes")
def get_recurrentes(u=Depends(get_current_user)):
    return query("""
        SELECT r.*, c.razon_social as cliente_nombre
        FROM ven_facturas_recurrentes r
        JOIN ven_clientes c ON c.id=r.cliente_id
        WHERE r.activa=true ORDER BY r.proximo_emision
    """)


@router.post("/facturas/recurrentes")
def crear_recurrente(cliente_id: int, frecuencia: str = "MENSUAL", dia_emision: int = 1,
                     descripcion: str = "", detalles: list = [], u=Depends(get_current_user)):
    """Create a recurring invoice template."""
    import json
    total = sum(float(d.get('cantidad', 1)) * float(d.get('precio_unitario', 0)) for d in detalles)

    today = date.today()
    if dia_emision <= today.day:
        if today.month == 12:
            prox = date(today.year + 1, 1, min(dia_emision, 28))
        else:
            prox = date(today.year, today.month + 1, min(dia_emision, 28))
    else:
        prox = date(today.year, today.month, min(dia_emision, 28))

    suc_id = u.get('sucursal_id')
    rid = insert("""
        INSERT INTO ven_facturas_recurrentes
            (cliente_id, vendedor_id, sucursal_id, frecuencia, dia_emision,
             proximo_emision, descripcion, detalles_json, total)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (cliente_id, None, suc_id, frecuencia, dia_emision, prox,
          descripcion, json.dumps(detalles), total))
    return {"id": rid, "msg": "Factura recurrente creada", "proximo": str(prox)}


@router.delete("/facturas/recurrentes/{rid}")
def eliminar_recurrente(rid: int, u=Depends(get_current_user)):
    execute("UPDATE ven_facturas_recurrentes SET activa=false WHERE id=%s", (rid,))
    return {"msg": "Desactivada"}


@router.post("/facturas/recurrentes/procesar")
def procesar_recurrentes(u=Depends(get_current_user)):
    """Process all recurring invoices due today or earlier."""
    import json
    from datetime import timedelta
    pendientes = query("SELECT * FROM ven_facturas_recurrentes WHERE activa=true AND proximo_emision <= CURRENT_DATE")
    emitidas = 0
    for rec in pendientes:
        try:
            dets = json.loads(rec.get('detalles_json', '[]'))
            body = FacturaIn(
                cliente_id=rec['cliente_id'], vendedor_id=rec.get('vendedor_id'),
                sucursal_id=rec.get('sucursal_id'), descuento_global_pct=0,
                detalles=dets,
                pagos=[{"forma_pago": "CREDITO", "monto": float(rec['total'])}]
            )
            crear_factura(body, u)
            emitidas += 1

            prox = rec['proximo_emision']
            freq = rec.get('frecuencia', 'MENSUAL')
            if freq == 'SEMANAL':
                prox = prox + timedelta(days=7)
            elif freq == 'QUINCENAL':
                prox = prox + timedelta(days=15)
            elif freq == 'MENSUAL':
                m = prox.month + 1
                y = prox.year
                if m > 12:
                    m = 1
                    y += 1
                prox = date(y, m, min(rec['dia_emision'], 28))
            elif freq == 'ANUAL':
                prox = date(prox.year + 1, prox.month, prox.day)

            execute("UPDATE ven_facturas_recurrentes SET proximo_emision=%s WHERE id=%s",
                    (prox, rec['id']))
        except Exception as e:
            print(f"Error factura recurrente {rec['id']}: {e}")

    return {"emitidas": emitidas, "msg": f"{emitidas} facturas recurrentes procesadas"}
