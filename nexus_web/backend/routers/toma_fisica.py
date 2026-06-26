from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/api/toma-fisica", tags=["Toma Fisica"])


# ── Schemas ──────────────────────────────────────────────────
class TomaFisicaIn(BaseModel):
    bodega_id:     int
    observaciones: Optional[str] = None


class ConteoIn(BaseModel):
    producto_id:   int
    stock_contado: float
    observaciones: Optional[str] = None


class ConteoItem(BaseModel):
    producto_id:   int
    stock_contado: float
    observaciones: Optional[str] = None


class ConteoLoteIn(BaseModel):
    conteos: List[ConteoItem]


# ── 1. Listar tomas ─────────────────────────────────────────
@router.get("")
def listar_tomas(
    estado:    Optional[str] = None,
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds  = ["1=1"]
    params = []
    if estado:
        conds.append("t.estado=%s"); params.append(estado)
    if fecha_ini:
        conds.append("t.fecha >= %s::timestamp"); params.append(fecha_ini)
    if fecha_fin:
        conds.append("t.fecha <= %s::timestamp + interval '1 day'"); params.append(fecha_fin)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT t.*,
               b.nombre  AS bodega_nombre,
               u.nombre  AS usuario_nombre
        FROM inv_tomas_fisicas t
        LEFT JOIN inv_bodegas    b ON b.id = t.bodega_id
        LEFT JOIN sys_usuarios   u ON u.id = t.usuario_id
        {where}
        ORDER BY t.fecha DESC
        LIMIT 200
    """, params)


# ── 2. Próximo número ───────────────────────────────────────
@router.get("/proximo-numero")
def proximo_numero(u=Depends(get_current_user)):
    row = query_one("SELECT COUNT(*) AS n FROM inv_tomas_fisicas")
    seq = int(row["n"] or 0) + 1
    numero = f"TF-001-{str(seq).zfill(5)}"
    return {"numero": numero}


# ── 3. Crear toma física ────────────────────────────────────
@router.post("")
def crear_toma(body: TomaFisicaIn, u=Depends(get_current_user)):
    # Generar número
    row = query_one("SELECT COUNT(*) AS n FROM inv_tomas_fisicas")
    seq = int(row["n"] or 0) + 1
    numero = f"TF-001-{str(seq).zfill(5)}"

    suc_id = u.get("sucursal_id")

    toma_id = insert("""
        INSERT INTO inv_tomas_fisicas
            (numero, bodega_id, sucursal_id, usuario_id, fecha,
             estado, observaciones, total_productos, total_diferencias)
        VALUES (%s, %s, %s, %s, NOW(), 'EN_PROCESO', %s, 0, 0)
    """, (numero, body.bodega_id, suc_id, u["id"], body.observaciones))

    # Cargar todos los productos activos con stock en esa bodega
    productos = query("""
        SELECT s.producto_id, s.cantidad AS stock_sistema
        FROM inv_stock s
        JOIN inv_productos p ON p.id = s.producto_id
        WHERE s.bodega_id = %s
          AND s.cantidad > 0
          AND p.activo = true
        ORDER BY p.descripcion
    """, (body.bodega_id,))

    for p in productos:
        insert("""
            INSERT INTO inv_toma_fisica_detalles
                (toma_id, producto_id, stock_sistema, stock_contado, diferencia, observaciones)
            VALUES (%s, %s, %s, NULL, 0, NULL)
        """, (toma_id, p["producto_id"], p["stock_sistema"]))

    # Actualizar total_productos
    execute(
        "UPDATE inv_tomas_fisicas SET total_productos = %s WHERE id = %s",
        (len(productos), toma_id),
    )

    return {
        "id": toma_id,
        "numero": numero,
        "total_productos": len(productos),
        "msg": f"Toma física {numero} creada con {len(productos)} productos",
    }


# ── 4. Detalle de toma ──────────────────────────────────────
@router.get("/{tid}")
def detalle_toma(tid: int, u=Depends(get_current_user)):
    t = query_one("""
        SELECT t.*,
               b.nombre AS bodega_nombre,
               u.nombre AS usuario_nombre
        FROM inv_tomas_fisicas t
        LEFT JOIN inv_bodegas  b ON b.id = t.bodega_id
        LEFT JOIN sys_usuarios u ON u.id = t.usuario_id
        WHERE t.id = %s
    """, (tid,))
    if not t:
        raise HTTPException(404, "Toma física no encontrada")

    t["detalles"] = query("""
        SELECT d.*,
               p.codigo,
               p.descripcion
        FROM inv_toma_fisica_detalles d
        JOIN inv_productos p ON p.id = d.producto_id
        WHERE d.toma_id = %s
        ORDER BY p.descripcion
    """, (tid,))

    # Calcular contados
    contados = sum(1 for d in t["detalles"] if d["stock_contado"] is not None)
    t["total_contados"] = contados

    return t


# ── 5. Contar un producto ───────────────────────────────────
@router.patch("/{tid}/contar")
def contar_producto(tid: int, body: ConteoIn, u=Depends(get_current_user)):
    t = query_one("SELECT id, estado FROM inv_tomas_fisicas WHERE id=%s", (tid,))
    if not t:
        raise HTTPException(404, "Toma física no encontrada")
    if t["estado"] != "EN_PROCESO":
        raise HTTPException(400, "La toma ya no está en proceso")

    det = query_one("""
        SELECT id, stock_sistema FROM inv_toma_fisica_detalles
        WHERE toma_id=%s AND producto_id=%s
    """, (tid, body.producto_id))
    if not det:
        raise HTTPException(404, "Producto no encontrado en esta toma")

    diferencia = body.stock_contado - float(det["stock_sistema"])
    execute("""
        UPDATE inv_toma_fisica_detalles
        SET stock_contado = %s,
            diferencia    = %s,
            observaciones = %s
        WHERE id = %s
    """, (body.stock_contado, diferencia, body.observaciones, det["id"]))

    # Actualizar total_diferencias
    difs = query_one("""
        SELECT COUNT(*) AS n FROM inv_toma_fisica_detalles
        WHERE toma_id=%s AND stock_contado IS NOT NULL AND diferencia != 0
    """, (tid,))
    execute(
        "UPDATE inv_tomas_fisicas SET total_diferencias = %s WHERE id = %s",
        (difs["n"], tid),
    )

    return {"msg": "Conteo actualizado", "diferencia": diferencia}


# ── 6. Contar lote ──────────────────────────────────────────
@router.patch("/{tid}/contar-lote")
def contar_lote(tid: int, body: ConteoLoteIn, u=Depends(get_current_user)):
    t = query_one("SELECT id, estado FROM inv_tomas_fisicas WHERE id=%s", (tid,))
    if not t:
        raise HTTPException(404, "Toma física no encontrada")
    if t["estado"] != "EN_PROCESO":
        raise HTTPException(400, "La toma ya no está en proceso")

    actualizados = 0
    for c in body.conteos:
        det = query_one("""
            SELECT id, stock_sistema FROM inv_toma_fisica_detalles
            WHERE toma_id=%s AND producto_id=%s
        """, (tid, c.producto_id))
        if not det:
            continue
        diferencia = c.stock_contado - float(det["stock_sistema"])
        execute("""
            UPDATE inv_toma_fisica_detalles
            SET stock_contado = %s,
                diferencia    = %s,
                observaciones = %s
            WHERE id = %s
        """, (c.stock_contado, diferencia, c.observaciones, det["id"]))
        actualizados += 1

    # Actualizar total_diferencias
    difs = query_one("""
        SELECT COUNT(*) AS n FROM inv_toma_fisica_detalles
        WHERE toma_id=%s AND stock_contado IS NOT NULL AND diferencia != 0
    """, (tid,))
    execute(
        "UPDATE inv_tomas_fisicas SET total_diferencias = %s WHERE id = %s",
        (difs["n"], tid),
    )

    return {"msg": f"{actualizados} conteos actualizados"}


# ── 7. Finalizar toma ───────────────────────────────────────
@router.post("/{tid}/finalizar")
def finalizar_toma(tid: int, u=Depends(get_current_user)):
    t = query_one("""
        SELECT t.*, b.nombre AS bodega_nombre
        FROM inv_tomas_fisicas t
        LEFT JOIN inv_bodegas b ON b.id = t.bodega_id
        WHERE t.id=%s
    """, (tid,))
    if not t:
        raise HTTPException(404, "Toma física no encontrada")
    if t["estado"] != "EN_PROCESO":
        raise HTTPException(400, "La toma ya no está en proceso")

    # Verificar que todos estén contados
    sin_contar = query_one("""
        SELECT COUNT(*) AS n FROM inv_toma_fisica_detalles
        WHERE toma_id=%s AND stock_contado IS NULL
    """, (tid,))
    if int(sin_contar["n"]) > 0:
        raise HTTPException(
            400,
            f"Faltan {sin_contar['n']} productos por contar",
        )

    # Obtener detalles con diferencia
    detalles = query("""
        SELECT d.*, p.codigo, p.descripcion
        FROM inv_toma_fisica_detalles d
        JOIN inv_productos p ON p.id = d.producto_id
        WHERE d.toma_id = %s AND d.diferencia != 0
    """, (tid,))

    ajuste_id = None
    ajuste_numero = None
    suc_id = u.get("sucursal_id")

    if detalles:
        # Crear ajuste automático
        ultimo = query_one("SELECT MAX(id) AS m FROM inv_ajustes")
        seq = int(ultimo["m"] or 0) + 1
        ajuste_numero = f"TF-AJ-{str(seq).zfill(8)}"

        ajuste_id = insert("""
            INSERT INTO inv_ajustes
                (numero, tipo, motivo, bodega_id, sucursal_id, usuario_id,
                 fecha, estado, observaciones)
            VALUES (%s, 'CARGO', %s, %s, %s, %s, NOW(), 'CONFIRMADO', %s)
        """, (
            ajuste_numero, "CARGO",
            f"Ajuste automático por toma física {t['numero']}",
            t["bodega_id"], suc_id, u["id"],
            f"Generado automáticamente desde toma física {t['numero']}",
        ))

        for det in detalles:
            dif = float(det["diferencia"])
            abs_dif = abs(dif)
            tipo_linea = "CARGO" if dif > 0 else "DESCARGO"

            # Insertar detalle de ajuste
            try:
                insert("""
                    INSERT INTO inv_ajuste_detalles
                        (ajuste_id, producto_id, cantidad, costo, motivo_det)
                    VALUES (%s, %s, %s, 0, %s)
                """, (
                    ajuste_id,
                    det["producto_id"],
                    abs_dif,
                    f"{tipo_linea} por toma física: sistema={det['stock_sistema']}, contado={det['stock_contado']}",
                ))
            except:
                pass

            # Actualizar stock real
            try:
                existe = query_one(
                    "SELECT id FROM inv_stock WHERE producto_id=%s AND bodega_id=%s",
                    (det["producto_id"], t["bodega_id"]),
                )
                if existe:
                    # Poner stock al valor contado
                    execute("""
                        UPDATE inv_stock SET cantidad = %s
                        WHERE producto_id=%s AND bodega_id=%s
                    """, (det["stock_contado"], det["producto_id"], t["bodega_id"]))
                elif dif > 0:
                    insert("""
                        INSERT INTO inv_stock (producto_id, bodega_id, cantidad)
                        VALUES (%s, %s, %s)
                    """, (det["producto_id"], t["bodega_id"], det["stock_contado"]))
            except:
                pass

    # Actualizar toma
    total_detalles = query("""
        SELECT d.*, CASE WHEN d.diferencia != 0 THEN 1 ELSE 0 END AS tiene_dif
        FROM inv_toma_fisica_detalles d WHERE d.toma_id = %s
    """, (tid,))
    total_productos = len(total_detalles)
    con_diferencia = sum(1 for d in total_detalles if float(d["diferencia"] or 0) != 0)
    sin_diferencia = total_productos - con_diferencia

    execute("""
        UPDATE inv_tomas_fisicas
        SET estado           = 'FINALIZADA',
            ajuste_id        = %s,
            total_diferencias= %s
        WHERE id = %s
    """, (ajuste_id, con_diferencia, tid))

    return {
        "msg": "Toma física finalizada",
        "total_productos": total_productos,
        "con_diferencia": con_diferencia,
        "sin_diferencia": sin_diferencia,
        "ajuste_id": ajuste_id,
        "ajuste_numero": ajuste_numero,
    }


# ── 8. Eliminar toma ────────────────────────────────────────
@router.delete("/{tid}")
def eliminar_toma(tid: int, u=Depends(get_current_user)):
    t = query_one("SELECT id, estado FROM inv_tomas_fisicas WHERE id=%s", (tid,))
    if not t:
        raise HTTPException(404, "Toma física no encontrada")
    if t["estado"] != "EN_PROCESO":
        raise HTTPException(400, "Solo se pueden eliminar tomas en proceso")
    execute("DELETE FROM inv_tomas_fisicas WHERE id=%s", (tid,))
    return {"msg": "Toma física eliminada"}
