"""
Importación de datos históricos: ventas, compras, saldos CxC y CxP.
Se agregan al router de importar.py
"""
from fastapi import Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from database import query_one, insert
from auth import get_current_user
from routers.importar import router, _leer_excel, _val, _float, _excel_template


# ══════════════════════════════════════════════════════════════
#  HISTORIAL DE VENTAS
# ══════════════════════════════════════════════════════════════

COLS_VENTAS = [
    ("numero",        "N° Factura",          "Ej: 001-001-000000123",      True),
    ("fecha",         "Fecha",               "YYYY-MM-DD",                 True),
    ("cliente_ruc",   "RUC/Cédula cliente",  "RUC o cédula del cliente",   False),
    ("vendedor_cod",  "Código vendedor",      "Código del vendedor (HERFER01)", False),
    ("subtotal_0",    "Subtotal 0%",         "Valor base 0%",              False),
    ("subtotal_iva",  "Subtotal IVA",        "Valor base gravado con IVA", False),
    ("iva",           "Valor IVA",           "Monto de IVA",               False),
    ("total",         "Total",               "Total de la factura",        True),
    ("observacion",   "Observación",         "Nota opcional",              False),
]

EJEMPLOS_VENTAS = [
    {"numero":"001-001-000000001","fecha":"2024-01-15","cliente_ruc":"1712345678",
     "vendedor_cod":"HERFER01","subtotal_0":"0","subtotal_iva":"89.29","iva":"13.39","total":"102.68","observacion":""},
    {"numero":"001-001-000000002","fecha":"2024-01-20","cliente_ruc":"0912345678001",
     "vendedor_cod":"CARLOG01","subtotal_0":"50","subtotal_iva":"0","iva":"0","total":"50.00","observacion":""},
]

@router.get("/plantilla/ventas-historicas")
def plantilla_ventas(u=Depends(get_current_user)):
    buf = _excel_template("Historial Ventas", COLS_VENTAS, EJEMPLOS_VENTAS)
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_ventas_historicas.xlsx"})

@router.post("/ventas-historicas")
async def importar_ventas(file: UploadFile = File(...), u=Depends(get_current_user)):
    headers, datos = _leer_excel(await file.read())
    ok, errores = 0, []

    # Cachear recursos fijos una sola vez
    suc = query_one("SELECT id FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1") \
          or query_one("SELECT id FROM sys_sucursales WHERE activa=true LIMIT 1")
    bod = query_one("SELECT id FROM inv_bodegas WHERE es_principal=true AND activa=true LIMIT 1") \
          or query_one("SELECT id FROM inv_bodegas WHERE activa=true LIMIT 1")
    consumidor = query_one("SELECT id FROM ven_clientes WHERE identificacion='9999999999999' LIMIT 1") \
                 or query_one("SELECT id FROM ven_clientes LIMIT 1")
    uid = u.get("id") or u.get("user_id") or 1

    for i, row in enumerate(datos, 4):
        try:
            numero = _val(row, "n° factura", "numero", "numero_factura", "factura", "comprobante")
            fecha  = _val(row, "fecha", "date", "fecha_emision")
            total  = _float(_val(row, "total", "valor total", "monto"))
            if not numero or not fecha or total <= 0:
                errores.append(f"Fila {i}: número, fecha y total son obligatorios"); continue

            ident = _val(row, "ruc/cédula cliente", "ruc/cedula", "cliente_ruc", "cedula", "ruc", "identificacion")
            cli   = query_one("SELECT id FROM ven_clientes WHERE identificacion=%s", (ident,)) if ident else None
            if not cli:
                cli = consumidor  # fallback a consumidor final si no hay cliente
            if not cli:
                errores.append(f"Fila {i}: no hay clientes en el sistema — importa clientes primero"); continue

            vend_cod = _val(row, "código vendedor", "vendedor_cod", "vendedor", "codigo_vendedor")
            vend  = query_one("SELECT id FROM ven_vendedores WHERE codigo=%s", (vend_cod,)) if vend_cod else None
            sub0  = _float(_val(row, "subtotal 0%", "subtotal_0", "base0"))
            subiva= _float(_val(row, "subtotal iva", "subtotal_iva", "baseiva"))
            iva   = _float(_val(row, "valor iva", "iva"))
            obs   = _val(row, "observacion", "observación")

            existe = query_one("SELECT id FROM ven_facturas WHERE numero_factura=%s", (numero,))
            if existe:
                errores.append(f"Fila {i}: factura {numero} ya existe"); continue

            insert("""
                INSERT INTO ven_facturas
                    (numero_factura, cliente_id, vendedor_id, sucursal_id, bodega_id,
                     usuario_id, fecha_emision, subtotal_0, subtotal_iva, iva, total, estado, observaciones)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'EMITIDA',%s)
            """, (numero, cli["id"], vend["id"] if vend else None,
                  suc["id"] if suc else None, bod["id"] if bod else None,
                  uid, fecha, sub0, subiva, iva, total, obs))
            ok += 1
        except Exception as e:
            errores.append(f"Fila {i}: {str(e)[:80]}")
    return {"importados": ok, "errores": errores,
            "msg": f"{ok} ventas importadas. {len(errores)} errores."}


# ══════════════════════════════════════════════════════════════
#  HISTORIAL DE COMPRAS
# ══════════════════════════════════════════════════════════════

COLS_COMPRAS = [
    ("numero",        "N° Factura proveedor","Ej: 001-001-000000456",  True),
    ("fecha",         "Fecha",               "YYYY-MM-DD",             True),
    ("proveedor_ruc", "RUC proveedor",       "RUC del proveedor",      False),
    ("subtotal",      "Subtotal",            "Base imponible",         False),
    ("iva",           "Valor IVA",           "Monto de IVA",           False),
    ("total",         "Total",               "Total de la compra",     True),
    ("observacion",   "Observación",         "Nota opcional",          False),
]

EJEMPLOS_COMPRAS = [
    {"numero":"001-001-000000456","fecha":"2024-01-10","proveedor_ruc":"1790123456001",
     "subtotal":"200","iva":"30","total":"230.00","observacion":""},
]

@router.get("/plantilla/compras-historicas")
def plantilla_compras(u=Depends(get_current_user)):
    buf = _excel_template("Historial Compras", COLS_COMPRAS, EJEMPLOS_COMPRAS)
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_compras_historicas.xlsx"})

@router.post("/compras-historicas")
async def importar_compras(file: UploadFile = File(...), u=Depends(get_current_user)):
    headers, datos = _leer_excel(await file.read())
    ok, errores = 0, []
    suc = query_one("SELECT id FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1") \
          or query_one("SELECT id FROM sys_sucursales WHERE activa=true LIMIT 1")
    bod = query_one("SELECT id FROM inv_bodegas WHERE es_principal=true AND activa=true LIMIT 1") \
          or query_one("SELECT id FROM inv_bodegas WHERE activa=true LIMIT 1")
    uid = u.get("id") or u.get("user_id") or 1
    for i, row in enumerate(datos, 4):
        try:
            numero = _val(row, "n° factura proveedor", "numero", "numero_factura", "comprobante")
            fecha  = _val(row, "fecha", "date")
            total  = _float(_val(row, "total", "valor total", "monto"))
            if not numero or not fecha or total <= 0:
                errores.append(f"Fila {i}: número, fecha y total son obligatorios"); continue

            ruc_pr = _val(row, "ruc proveedor", "proveedor_ruc", "ruc", "proveedor")
            prov   = query_one("SELECT id FROM com_proveedores WHERE identificacion=%s", (ruc_pr,)) if ruc_pr else None
            sub    = _float(_val(row, "subtotal", "base", "subtotal_0"))
            iva    = _float(_val(row, "valor iva", "iva"))
            obs    = _val(row, "observacion", "observación")

            existe = query_one("SELECT id FROM com_compras WHERE numero_factura_prov=%s", (numero,))
            if existe:
                errores.append(f"Fila {i}: compra {numero} ya existe"); continue

            insert("""
                INSERT INTO com_compras
                    (numero_factura_prov, num_documento, proveedor_id, sucursal_id, bodega_id,
                     usuario_id, fecha, subtotal_0, iva, total, estado, observaciones)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'CONFIRMADA',%s)
            """, (numero, numero, prov["id"] if prov else None,
                  suc["id"] if suc else None, bod["id"] if bod else None,
                  uid, fecha, sub, iva, total, obs))
            ok += 1
        except Exception as e:
            errores.append(f"Fila {i}: {str(e)[:80]}")
    return {"importados": ok, "errores": errores,
            "msg": f"{ok} compras importadas. {len(errores)} errores."}


# ══════════════════════════════════════════════════════════════
#  SALDOS INICIALES CxC (lo que deben los clientes)
# ══════════════════════════════════════════════════════════════

COLS_CXC = [
    ("cliente_ruc",      "RUC/Cédula",        "RUC o cédula del cliente",  True),
    ("referencia",       "N° Factura ref.",   "Número de factura origen",  False),
    ("fecha_emision",    "Fecha emisión",     "YYYY-MM-DD",                True),
    ("fecha_vencimiento","Fecha vencimiento", "YYYY-MM-DD",                True),
    ("valor_total",      "Valor total",       "Monto total de la deuda",   True),
    ("valor_pagado",     "Ya pagado",         "Si ya abonó algo, cuánto",  False),
    ("observacion",      "Observación",       "Nota opcional",             False),
]

EJEMPLOS_CXC = [
    {"cliente_ruc":"1712345678","referencia":"001-001-000000123","fecha_emision":"2024-11-01",
     "fecha_vencimiento":"2024-12-01","valor_total":"500.00","valor_pagado":"0","observacion":"Saldo migración"},
    {"cliente_ruc":"0912345678001","referencia":"001-001-000000456","fecha_emision":"2024-12-01",
     "fecha_vencimiento":"2025-01-01","valor_total":"1200.00","valor_pagado":"300","observacion":""},
]

@router.get("/plantilla/saldos-cxc")
def plantilla_cxc(u=Depends(get_current_user)):
    buf = _excel_template("Saldos CxC", COLS_CXC, EJEMPLOS_CXC)
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_saldos_cxc.xlsx"})

@router.post("/saldos-cxc")
async def importar_cxc(file: UploadFile = File(...), u=Depends(get_current_user)):
    headers, datos = _leer_excel(await file.read())
    ok, errores = 0, []
    for i, row in enumerate(datos, 4):
        try:
            ident   = _val(row, "ruc/cédula", "ruc/cedula", "cliente_ruc", "cedula", "ruc", "identificacion")
            fecha_e = _val(row, "fecha emision", "fecha_emision", "fecha emisión", "fecha")
            fecha_v = _val(row, "fecha vencimiento", "fecha_vencimiento", "vencimiento")
            total   = _float(_val(row, "valor total", "valor_total", "total", "monto"))
            if not ident or not fecha_e or not fecha_v or total <= 0:
                errores.append(f"Fila {i}: RUC/cédula, fechas y valor son obligatorios"); continue

            cli = query_one("SELECT id FROM ven_clientes WHERE identificacion=%s", (ident,))
            if not cli:
                errores.append(f"Fila {i}: cliente {ident} no encontrado — impórtalo primero"); continue

            pagado = _float(_val(row, "ya pagado", "valor_pagado", "pagado", "abonado"))
            saldo  = round(total - pagado, 2)
            ref    = _val(row, "n° factura ref.", "referencia", "factura")
            obs    = _val(row, "observación", "observacion")
            estado = "PAGADA" if saldo <= 0 else "PENDIENTE"

            insert("""
                INSERT INTO fin_cxc
                    (cliente_id, fecha_emision, fecha_vencimiento,
                     valor_total, valor_pagado, saldo, estado, observaciones)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (cli["id"], fecha_e, fecha_v, total, pagado, saldo, estado,
                  f"[SALDO INICIAL] {ref} {obs}".strip()))
            ok += 1
        except Exception as e:
            errores.append(f"Fila {i}: {str(e)[:80]}")
    return {"importados": ok, "errores": errores,
            "msg": f"{ok} saldos CxC importados. {len(errores)} errores."}


# ══════════════════════════════════════════════════════════════
#  SALDOS INICIALES CxP (lo que deben a proveedores)
# ══════════════════════════════════════════════════════════════

COLS_CXP = [
    ("proveedor_ruc",    "RUC proveedor",     "RUC del proveedor",       True),
    ("referencia",       "N° Factura ref.",   "Número de factura origen",False),
    ("fecha_emision",    "Fecha emisión",     "YYYY-MM-DD",              True),
    ("fecha_vencimiento","Fecha vencimiento", "YYYY-MM-DD",              True),
    ("valor_total",      "Valor total",       "Monto total de la deuda", True),
    ("valor_pagado",     "Ya pagado",         "Si ya abonó algo",        False),
    ("observacion",      "Observación",       "Nota opcional",           False),
]

EJEMPLOS_CXP = [
    {"proveedor_ruc":"1790123456001","referencia":"001-001-000000789","fecha_emision":"2024-11-15",
     "fecha_vencimiento":"2024-12-15","valor_total":"800.00","valor_pagado":"200","observacion":"Saldo migración"},
]

@router.get("/plantilla/saldos-cxp")
def plantilla_cxp(u=Depends(get_current_user)):
    buf = _excel_template("Saldos CxP", COLS_CXP, EJEMPLOS_CXP)
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_saldos_cxp.xlsx"})

@router.post("/saldos-cxp")
async def importar_cxp(file: UploadFile = File(...), u=Depends(get_current_user)):
    headers, datos = _leer_excel(await file.read())
    ok, errores = 0, []
    for i, row in enumerate(datos, 4):
        try:
            ruc     = _val(row, "ruc proveedor", "proveedor_ruc", "ruc", "proveedor")
            fecha_e = _val(row, "fecha emisión", "fecha_emision", "fecha")
            fecha_v = _val(row, "fecha vencimiento", "fecha_vencimiento", "vencimiento")
            total   = _float(_val(row, "valor total", "valor_total", "total", "monto"))
            if not ruc or not fecha_e or not fecha_v or total <= 0:
                errores.append(f"Fila {i}: RUC, fechas y valor son obligatorios"); continue

            prov = query_one("SELECT id FROM com_proveedores WHERE identificacion=%s", (ruc,))
            if not prov:
                errores.append(f"Fila {i}: proveedor {ruc} no encontrado — impórtalo primero"); continue

            pagado = _float(_val(row, "ya pagado", "valor_pagado", "pagado", "abonado"))
            saldo  = round(total - pagado, 2)
            ref    = _val(row, "n° factura ref.", "referencia", "factura")
            obs    = _val(row, "observación", "observacion")
            estado = "PAGADA" if saldo <= 0 else "PENDIENTE"

            insert("""
                INSERT INTO fin_cxp
                    (proveedor_id, fecha_emision, fecha_vencimiento,
                     valor_total, valor_pagado, saldo, estado, observaciones)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (prov["id"], fecha_e, fecha_v, total, pagado, saldo, estado,
                  f"[SALDO INICIAL] {ref} {obs}".strip()))
            ok += 1
        except Exception as e:
            errores.append(f"Fila {i}: {str(e)[:80]}")
    return {"importados": ok, "errores": errores,
            "msg": f"{ok} saldos CxP importados. {len(errores)} errores."}
