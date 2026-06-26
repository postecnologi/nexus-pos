from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/transferencias", tags=["Transferencias"])


class TransfDetalleIn(BaseModel):
    producto_id: int
    cantidad:    float
    series:      list = []   # lista de serie_id (int)

class TransferenciaIn(BaseModel):
    bodega_origen_id:  int
    bodega_destino_id: int
    observaciones:     Optional[str] = None
    detalles:          list


@router.get("/proximo-numero")
def proximo_numero_transf(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    ultimo = query_one("SELECT MAX(id) as max_id FROM inv_transferencias")
    seq    = int(ultimo["max_id"] or 0) + 1
    suc    = query_one("SELECT codigo_establecimiento FROM sys_sucursales WHERE id=%s", (suc_id,)) if suc_id else None
    cod    = suc["codigo_establecimiento"] if suc else "001"
    return {"numero": f"T-{cod}-{str(seq).zfill(9)}"}


@router.get("")
def get_transferencias(
    busqueda:  Optional[str] = None,
    u=Depends(get_current_user)
):
    conds  = ["t.estado != 'ANULADA'"]
    params = []
    if busqueda:
        conds.append("(bo.nombre ILIKE %s OR bd.nombre ILIKE %s OR t.numero ILIKE %s)")
        params += [f"%{busqueda}%"]*3
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT t.*,
               bo.nombre as bodega_origen,
               bd.nombre as bodega_destino,
               u.nombre  as usuario_nombre,
               (SELECT COUNT(*) FROM inv_transferencia_detalles WHERE transferencia_id=t.id) as num_productos,
               (SELECT COUNT(*) FROM inv_transferencia_series ts
                JOIN inv_transferencia_detalles td ON td.id=ts.transferencia_detalle_id
                WHERE td.transferencia_id=t.id) as num_series
        FROM inv_transferencias t
        JOIN inv_bodegas bo      ON bo.id = t.bodega_origen_id
        JOIN inv_bodegas bd      ON bd.id = t.bodega_destino_id
        LEFT JOIN sys_usuarios u ON u.id  = t.usuario_id
        {where}
        ORDER BY t.fecha DESC, t.id DESC
        LIMIT 200
    """, params)


@router.post("")
def crear_transferencia(tr: TransferenciaIn, u=Depends(get_current_user)):
    if not tr.detalles:
        raise HTTPException(400, "Debe incluir al menos un producto")
    if tr.bodega_origen_id == tr.bodega_destino_id:
        raise HTTPException(400, "La bodega origen y destino deben ser diferentes")

    # Validar bodegas
    b_orig = query_one("SELECT id, nombre FROM inv_bodegas WHERE id=%s AND activa=true", (tr.bodega_origen_id,))
    b_dest = query_one("SELECT id, nombre FROM inv_bodegas WHERE id=%s AND activa=true", (tr.bodega_destino_id,))
    if not b_orig: raise HTTPException(400, "Bodega origen no existe o no esta activa")
    if not b_dest: raise HTTPException(400, "Bodega destino no existe o no esta activa")

    suc_id = u.get("sucursal_id")
    ultimo = query_one("SELECT MAX(id) as max_id FROM inv_transferencias")
    seq    = int(ultimo["max_id"] or 0) + 1
    suc    = query_one("SELECT codigo_establecimiento FROM sys_sucursales WHERE id=%s", (suc_id,)) if suc_id else None
    cod    = suc["codigo_establecimiento"] if suc else "001"
    numero = f"T-{cod}-{str(seq).zfill(9)}"

    # Crear cabecera
    tr_id = insert("""
        INSERT INTO inv_transferencias
            (numero, bodega_origen_id, bodega_destino_id, usuario_id,
             sucursal_id, fecha, estado, observaciones)
        VALUES (%s,%s,%s,%s,%s,NOW(),'CONFIRMADA',%s)
    """, (numero, tr.bodega_origen_id, tr.bodega_destino_id,
          u["id"], suc_id, tr.observaciones))

    for det in tr.detalles:
        pid  = det["producto_id"]
        cant = float(det["cantidad"])
        series = det.get("series", [])

        # Insertar detalle
        det_id = insert("""
            INSERT INTO inv_transferencia_detalles
                (transferencia_id, producto_id, cantidad)
            VALUES (%s,%s,%s)
        """, (tr_id, pid, cant))

        # Mover stock: restar origen, sumar destino
        try:
            execute("""
                UPDATE inv_stock SET cantidad = cantidad - %s
                WHERE producto_id=%s AND bodega_id=%s
            """, (cant, pid, tr.bodega_origen_id))
        except: pass

        try:
            existe = query_one(
                "SELECT id FROM inv_stock WHERE producto_id=%s AND bodega_id=%s",
                (pid, tr.bodega_destino_id))
            if existe:
                execute("""
                    UPDATE inv_stock SET cantidad = cantidad + %s
                    WHERE producto_id=%s AND bodega_id=%s
                """, (cant, pid, tr.bodega_destino_id))
            else:
                insert("""
                    INSERT INTO inv_stock (producto_id, bodega_id, cantidad)
                    VALUES (%s,%s,%s)
                """, (pid, tr.bodega_destino_id, cant))
        except: pass

        # Procesar series
        for serie_id in series:
            try:
                # Registrar en inv_transferencia_series
                insert("""
                    INSERT INTO inv_transferencia_series
                        (transferencia_detalle_id, serie_id)
                    VALUES (%s,%s)
                """, (det_id, serie_id))
                # Cambiar bodega y estado de la serie
                execute("""
                    UPDATE inv_series
                    SET bodega_id=%s, estado='DISPONIBLE'
                    WHERE id=%s
                """, (tr.bodega_destino_id, serie_id))
            except: pass

    return {
        "id":     tr_id,
        "numero": numero,
        "msg":    f"Transferencia {numero} confirmada correctamente"
    }


@router.get("/{tr_id}/detalle")
def detalle_transferencia(tr_id: int, u=Depends(get_current_user)):
    t = query_one("""
        SELECT t.*,
               bo.nombre as bodega_origen,
               bd.nombre as bodega_destino,
               u.nombre  as usuario_nombre
        FROM inv_transferencias t
        JOIN inv_bodegas bo      ON bo.id = t.bodega_origen_id
        JOIN inv_bodegas bd      ON bd.id = t.bodega_destino_id
        LEFT JOIN sys_usuarios u ON u.id  = t.usuario_id
        WHERE t.id=%s
    """, (tr_id,))
    if not t: raise HTTPException(404)

    detalles = query("""
        SELECT td.*, p.descripcion, p.codigo, p.aplica_series
        FROM inv_transferencia_detalles td
        JOIN inv_productos p ON p.id = td.producto_id
        WHERE td.transferencia_id=%s
    """, (tr_id,))

    for det in detalles:
        det["series"] = query("""
            SELECT s.id, s.serie, s.estado
            FROM inv_transferencia_series ts
            JOIN inv_series s ON s.id = ts.serie_id
            WHERE ts.transferencia_detalle_id=%s
        """, (det["id"],))

    t["detalles"] = detalles
    return t


@router.patch("/{tr_id}/anular")
def anular_transferencia(tr_id: int, u=Depends(get_current_user)):
    t = query_one("SELECT * FROM inv_transferencias WHERE id=%s", (tr_id,))
    if not t: raise HTTPException(404)
    if t["estado"] == "ANULADA": raise HTTPException(400, "Ya esta anulada")

    detalles = query("""
        SELECT td.*, p.aplica_series
        FROM inv_transferencia_detalles td
        JOIN inv_productos p ON p.id=td.producto_id
        WHERE td.transferencia_id=%s
    """, (tr_id,))

    for det in detalles:
        cant = float(det["cantidad"])
        # Revertir stock
        try:
            execute("""
                UPDATE inv_stock SET cantidad = cantidad + %s
                WHERE producto_id=%s AND bodega_id=%s
            """, (cant, det["producto_id"], t["bodega_origen_id"]))
            execute("""
                UPDATE inv_stock SET cantidad = cantidad - %s
                WHERE producto_id=%s AND bodega_id=%s
            """, (cant, det["producto_id"], t["bodega_destino_id"]))
        except: pass

        # Revertir series
        series = query("""
            SELECT s.id FROM inv_transferencia_series ts
            JOIN inv_series s ON s.id=ts.serie_id
            WHERE ts.transferencia_detalle_id=%s
        """, (det["id"],))
        for s in series:
            try:
                execute("""
                    UPDATE inv_series SET bodega_id=%s WHERE id=%s
                """, (t["bodega_origen_id"], s["id"]))
            except: pass

    execute("UPDATE inv_transferencias SET estado='ANULADA' WHERE id=%s", (tr_id,))
    return {"msg": "Transferencia anulada y stock revertido"}
