"""
Router Liquidaciones de Compra — Documento electronico tipo 03 Ecuador
Para compras a proveedores informales que no tienen RUC.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/liquidaciones", tags=["Liquidaciones"])


# -- Modelos --
class LiquidacionDetalleIn(BaseModel):
    descripcion: str
    cantidad: float = 1
    precio_unitario: float
    iva_porcentaje: float = 15.0


class LiquidacionIn(BaseModel):
    proveedor_nombre: str
    proveedor_ruc: Optional[str] = None
    proveedor_direccion: Optional[str] = None
    detalles: list  # List of LiquidacionDetalleIn dicts


# -- 1. Listar liquidaciones --
@router.get("")
def get_liquidaciones(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    busqueda: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds = ["1=1"]
    params = []

    suc_id = u.get("sucursal_id")
    if suc_id:
        conds.append("l.sucursal_id=%s")
        params.append(suc_id)

    if fecha_ini:
        conds.append("l.fecha_emision >= %s")
        params.append(fecha_ini)
    if fecha_fin:
        conds.append("l.fecha_emision <= %s")
        params.append(fecha_fin)
    if busqueda:
        conds.append("(l.proveedor_nombre ILIKE %s OR l.numero ILIKE %s OR l.proveedor_ruc ILIKE %s)")
        params += [f"%{busqueda}%"] * 3

    where = "WHERE " + " AND ".join(conds)

    return query(f"""
        SELECT l.*
        FROM com_liquidaciones l
        {where}
        ORDER BY l.fecha_emision DESC, l.id DESC
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
    seq = int(suc.get("secuencial_liquidacion") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    return {
        "numero": f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}",
        "secuencial": seq,
    }


# -- 3. Crear liquidacion --
@router.post("")
def crear_liquidacion(body: LiquidacionIn, u=Depends(get_current_user)):
    if not body.detalles:
        raise HTTPException(400, "Debe incluir al menos un detalle")

    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada")

    suc_id = suc["id"]
    seq = int(suc.get("secuencial_liquidacion") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    numero = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"

    emp = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct_default = float(emp["iva_porcentaje"]) if emp and emp.get("iva_porcentaje") else 15.0

    # Calcular totales
    sub0 = 0.0
    subiva = 0.0
    iva_total = 0.0
    detalles_calc = []
    for d in body.detalles:
        det = d if isinstance(d, dict) else d.dict()
        cant = float(det.get("cantidad", 1))
        pu = float(det.get("precio_unitario", 0))
        iv_pct = float(det.get("iva_porcentaje", iva_pct_default))
        subtotal_linea = round(cant * pu, 2)
        iva_val = round(subtotal_linea * iv_pct / 100, 2) if iv_pct > 0 else 0.0
        total_linea = round(subtotal_linea + iva_val, 2)

        if iv_pct == 0:
            sub0 += subtotal_linea
        else:
            subiva += subtotal_linea

        iva_total += iva_val

        detalles_calc.append({
            "descripcion": det.get("descripcion", ""),
            "cantidad": cant,
            "precio_unitario": pu,
            "iva_porcentaje": iv_pct,
            "subtotal": subtotal_linea,
            "iva_valor": iva_val,
            "total": total_linea,
        })

    total = round(sub0 + subiva + iva_total, 2)

    # Generar clave de acceso SRI (tipo 03)
    clave_acceso = None
    if emp:
        try:
            ruc_emp = emp.get("ruc") or "9999999999999"
            amb = emp.get("ambiente_sri") or "1"
            fecha_e = date.today().strftime("%d%m%Y")
            tipo_c = "03"  # Liquidacion de compra
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
            print(f"Error generando clave SRI para liquidacion: {e}")

    liq_id = insert("""
        INSERT INTO com_liquidaciones
            (numero, proveedor_nombre, proveedor_ruc, proveedor_direccion,
             sucursal_id, usuario_id, fecha_emision,
             subtotal_0, subtotal_iva, iva, total,
             estado, estado_sri, clave_acceso)
        VALUES (%s, %s, %s, %s, %s, %s, CURRENT_DATE,
                %s, %s, %s, %s,
                'EMITIDA', 'NO_ENVIADA', %s)
    """, (
        numero, body.proveedor_nombre, body.proveedor_ruc,
        body.proveedor_direccion, suc_id, u["id"],
        round(sub0, 2), round(subiva, 2), round(iva_total, 2), total,
        clave_acceso,
    ))

    # Insertar detalles
    for det in detalles_calc:
        insert("""
            INSERT INTO com_liquidacion_detalles
                (liquidacion_id, descripcion, cantidad, precio_unitario,
                 iva_porcentaje, subtotal, iva_valor, total)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            liq_id, det["descripcion"], det["cantidad"], det["precio_unitario"],
            det["iva_porcentaje"], det["subtotal"], det["iva_valor"], det["total"],
        ))

    # Incrementar secuencial
    execute("UPDATE sys_sucursales SET secuencial_liquidacion = %s WHERE id = %s",
            (seq + 1, suc_id))

    return {
        "id": liq_id,
        "numero": numero,
        "total": total,
        "clave_acceso": clave_acceso,
        "msg": "Liquidacion de compra emitida correctamente",
    }


# -- 4. Detalle --
@router.get("/{lid}")
def get_liquidacion(lid: int, u=Depends(get_current_user)):
    l = query_one("""
        SELECT l.*,
               emp.razon_social AS empresa_nombre,
               emp.ruc AS empresa_ruc,
               emp.direccion AS empresa_dir
        FROM com_liquidaciones l
        LEFT JOIN sys_empresas emp ON emp.activa = true
        WHERE l.id = %s
    """, (lid,))
    if not l:
        raise HTTPException(404, "Liquidacion de compra no encontrada")

    l["detalles"] = query("""
        SELECT * FROM com_liquidacion_detalles
        WHERE liquidacion_id = %s ORDER BY id
    """, (lid,))

    return l


# -- 5. Anular --
@router.patch("/{lid}/anular")
def anular_liquidacion(lid: int, u=Depends(get_current_user)):
    l = query_one("SELECT estado, numero FROM com_liquidaciones WHERE id=%s", (lid,))
    if not l:
        raise HTTPException(404, "Liquidacion de compra no encontrada")
    if l["estado"] == "ANULADA":
        raise HTTPException(400, "La liquidacion ya esta anulada")
    execute("UPDATE com_liquidaciones SET estado='ANULADA' WHERE id=%s", (lid,))
    return {"msg": "Liquidacion de compra anulada correctamente"}
