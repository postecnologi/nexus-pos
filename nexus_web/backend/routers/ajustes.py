from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/ajustes", tags=["Ajustes"])


class AjusteDetalleIn(BaseModel):
    producto_id:  int
    cantidad:     float
    serie_id:     Optional[int]  = None
    costo:        float          = 0
    motivo_det:   Optional[str]  = None
    estado_serie: str            = "DISPONIBLE"

class AjusteIn(BaseModel):
    tipo:         str   # CARGO, DESCARGO
    motivo:       str
    bodega_id:    int
    observaciones:Optional[str] = None
    detalles:     list


@router.get("")
def get_ajustes(
    tipo:      Optional[str] = None,
    busqueda:  Optional[str] = None,
    u=Depends(get_current_user)
):
    suc_id = u.get("sucursal_id")
    conds  = ["a.sucursal_id=%s"]
    params = [suc_id]
    if tipo:     conds.append("a.tipo=%s");      params.append(tipo)
    if busqueda: conds.append("(a.numero ILIKE %s OR a.motivo ILIKE %s)"); params+=[f"%{busqueda}%"]*2
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT a.*,
               b.nombre as bodega_nombre,
               u.nombre as usuario_nombre,
               COUNT(d.id) as num_productos,
               SUM(d.cantidad) as total_unidades
        FROM inv_ajustes a
        JOIN inv_bodegas b     ON b.id = a.bodega_id
        LEFT JOIN sys_usuarios u ON u.id = a.usuario_id
        LEFT JOIN inv_ajuste_detalles d ON d.ajuste_id = a.id
        {where}
        GROUP BY a.id, b.nombre, u.nombre
        ORDER BY a.fecha DESC
        LIMIT 200
    """, params)


@router.post("")
def crear_ajuste(aj: AjusteIn, u=Depends(get_current_user)):
    if not aj.detalles:
        raise HTTPException(400, "Debe incluir al menos un producto")
    if aj.tipo not in ("CARGO","DESCARGO"):
        raise HTTPException(400, "Tipo debe ser CARGO o DESCARGO")

    suc_id = u.get("sucursal_id")

    # Numero secuencial
    ultimo = query_one("SELECT MAX(id) as m FROM inv_ajustes")
    seq    = int(ultimo["m"] or 0) + 1
    prefijo = "CAR" if aj.tipo=="CARGO" else "DES"
    numero  = f"{prefijo}-{str(seq).zfill(8)}"

    aj_id = insert("""
        INSERT INTO inv_ajustes
            (numero, tipo, motivo, bodega_id, sucursal_id, usuario_id,
             fecha, estado, observaciones)
        VALUES (%s,%s,%s,%s,%s,%s,NOW(),'CONFIRMADO',%s)
    """, (numero, aj.tipo, aj.motivo, aj.bodega_id,
          suc_id, u["id"], aj.observaciones))

    for det in aj.detalles:
        pid     = det["producto_id"]
        cant    = float(det["cantidad"])
        costo   = float(det.get("costo") or 0)
        serie_id= det.get("serie_id")
        est_ser = det.get("estado_serie","DISPONIBLE")

        insert("""
            INSERT INTO inv_ajuste_detalles
                (ajuste_id, producto_id, serie_id, cantidad, costo,
                 motivo_det, estado_serie)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (aj_id, pid, serie_id, cant, costo,
              det.get("motivo_det"), est_ser))

        # Actualizar stock
        try:
            existe = query_one(
                "SELECT id FROM inv_stock WHERE producto_id=%s AND bodega_id=%s",
                (pid, aj.bodega_id))
            if existe:
                if aj.tipo == "CARGO":
                    execute("""
                        UPDATE inv_stock SET cantidad = cantidad + %s
                        WHERE producto_id=%s AND bodega_id=%s
                    """, (cant, pid, aj.bodega_id))
                else:
                    execute("""
                        UPDATE inv_stock SET cantidad = GREATEST(0, cantidad - %s)
                        WHERE producto_id=%s AND bodega_id=%s
                    """, (cant, pid, aj.bodega_id))
            elif aj.tipo == "CARGO":
                insert("""
                    INSERT INTO inv_stock (producto_id, bodega_id, cantidad)
                    VALUES (%s,%s,%s)
                """, (pid, aj.bodega_id, cant))
        except: pass

        # Actualizar serie si aplica
        if serie_id:
            try:
                if aj.tipo == "DESCARGO":
                    execute("""
                        UPDATE inv_series SET estado=%s WHERE id=%s
                    """, (est_ser, serie_id))
                else:
                    execute("""
                        UPDATE inv_series SET estado='DISPONIBLE', bodega_id=%s WHERE id=%s
                    """, (aj.bodega_id, serie_id))
            except: pass

    return {"id": aj_id, "numero": numero, "msg": f"Ajuste {numero} creado"}


@router.get("/{aj_id}/detalle")
def detalle_ajuste(aj_id: int, u=Depends(get_current_user)):
    a = query_one("""
        SELECT a.*, b.nombre as bodega_nombre, u.nombre as usuario_nombre
        FROM inv_ajustes a
        JOIN inv_bodegas b     ON b.id = a.bodega_id
        LEFT JOIN sys_usuarios u ON u.id = a.usuario_id
        WHERE a.id=%s
    """, (aj_id,))
    if not a: raise HTTPException(404)
    a["detalles"] = query("""
        SELECT d.*, p.descripcion, p.codigo, s.serie
        FROM inv_ajuste_detalles d
        JOIN inv_productos p   ON p.id = d.producto_id
        LEFT JOIN inv_series s ON s.id = d.serie_id
        WHERE d.ajuste_id=%s
    """, (aj_id,))
    return a
