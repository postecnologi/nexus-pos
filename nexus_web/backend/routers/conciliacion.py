from fastapi import APIRouter, Depends, HTTPException, UploadFile
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/conciliaciones", tags=["Conciliacion"])


@router.get("")
def get_conciliaciones(cuenta_id: Optional[int] = None, u=Depends(get_current_user)):
    conds  = ["1=1"]
    params = []
    if cuenta_id:
        conds.append("c.cuenta_id=%s")
        params.append(cuenta_id)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT c.*,
               cb.nombre as cuenta_nombre, cb.numero as numero_cuenta,
               sb.nombre as banco,
               (SELECT COUNT(*) FROM fin_estado_cuenta WHERE conciliacion_id=c.id) as total_lineas,
               (SELECT COUNT(*) FROM fin_estado_cuenta WHERE conciliacion_id=c.id AND conciliado=true) as lineas_conciliadas
        FROM fin_conciliaciones c
        JOIN fin_cuentas_bancarias cb ON cb.id = c.cuenta_id
        LEFT JOIN sys_bancos sb        ON sb.id = cb.banco_id
        {where}
        ORDER BY c.periodo DESC, c.id DESC
    """, params)


class ConciliacionIn(BaseModel):
    cuenta_id:      int
    periodo:        str    # formato YYYY-MM  ej: 2026-06
    saldo_banco:    float = 0
    saldo_sistema:  float = 0

@router.post("")
def crear_conciliacion(c: ConciliacionIn, u=Depends(get_current_user)):
    # Verificar que no exista ya para ese periodo y cuenta
    existe = query_one(
        "SELECT id FROM fin_conciliaciones WHERE cuenta_id=%s AND periodo=%s",
        (c.cuenta_id, c.periodo))
    if existe:
        raise HTTPException(400, f"Ya existe una conciliacion para {c.periodo}")

    cid = insert("""
        INSERT INTO fin_conciliaciones
            (cuenta_id, usuario_id, periodo, saldo_banco, saldo_sistema, estado)
        VALUES (%s,%s,%s,%s,%s,'BORRADOR')
    """, (c.cuenta_id, u["id"], c.periodo, c.saldo_banco, c.saldo_sistema))

    # Derivar fecha_ini y fecha_fin del periodo
    import calendar as cal
    year, month = int(c.periodo[:4]), int(c.periodo[5:7])
    fecha_ini = f"{c.periodo}-01"
    fecha_fin = f"{c.periodo}-{cal.monthrange(year,month)[1]:02d}"

    # Cargar movimientos del sistema para el periodo
    movs = query("""
        SELECT * FROM fin_movimientos_bancarios
        WHERE cuenta_id=%s AND fecha>=%s AND fecha<=%s
        ORDER BY fecha, id
    """, (c.cuenta_id, fecha_ini, fecha_fin))

    for m in movs:
        es_credito = m["tipo"] in ("DEPOSITO","DEPOSITO_EFECTIVO","LOTE_TARJETA","TRANSFERENCIA_RECIBIDA")
        monto = float(m["monto"])
        insert("""
            INSERT INTO fin_estado_cuenta
                (conciliacion_id, fecha, descripcion, referencia,
                 debito, credito, movimiento_id, conciliado)
            VALUES (%s,%s,%s,%s,%s,%s,%s,false)
        """, (cid, m["fecha"], m["concepto"], m.get("referencia"),
              0 if es_credito else monto,
              monto if es_credito else 0,
              m["id"]))

    return {"id": cid, "msg": f"Conciliacion {c.periodo} creada"}


@router.get("/{cid}")
def get_conciliacion(cid: int, u=Depends(get_current_user)):
    c = query_one("""
        SELECT c.*,
               cb.nombre as cuenta_nombre, cb.numero as numero_cuenta,
               sb.nombre as banco
        FROM fin_conciliaciones c
        JOIN fin_cuentas_bancarias cb ON cb.id = c.cuenta_id
        LEFT JOIN sys_bancos sb        ON sb.id = cb.banco_id
        WHERE c.id=%s
    """, (cid,))
    if not c: raise HTTPException(404)

    # Lineas del estado de cuenta (banco + sistema)
    lineas = query("""
        SELECT ec.*,
               m.tipo as mov_tipo, m.concepto as mov_concepto
        FROM fin_estado_cuenta ec
        LEFT JOIN fin_movimientos_bancarios m ON m.id = ec.movimiento_id
        WHERE ec.conciliacion_id=%s
        ORDER BY ec.fecha, ec.id
    """, (cid,))

    # Movimientos del sistema no incluidos aun (para agregar)
    fecha_ini = c["periodo"] + "-01"
    mov_sistema = query("""
        SELECT m.* FROM fin_movimientos_bancarios m
        WHERE m.cuenta_id=%s AND m.fecha >= %s::date
          AND m.fecha < (%s::date + interval '1 month')
          AND m.id NOT IN (
              SELECT movimiento_id FROM fin_estado_cuenta
              WHERE conciliacion_id=%s AND movimiento_id IS NOT NULL
          )
        ORDER BY m.fecha, m.id
    """, (c["cuenta_id"], fecha_ini, fecha_ini, cid))

    # Calcular totales
    tot_cred_banco  = sum(float(l["credito"]) for l in lineas if l["movimiento_id"] is None)
    tot_deb_banco   = sum(float(l["debito"])  for l in lineas if l["movimiento_id"] is None)
    tot_cred_sis    = sum(float(l["credito"]) for l in lineas if l["movimiento_id"] is not None)
    tot_deb_sis     = sum(float(l["debito"])  for l in lineas if l["movimiento_id"] is not None)
    conciliadas     = sum(1 for l in lineas if l["conciliado"])
    pendientes      = sum(1 for l in lineas if not l["conciliado"])
    saldo_banco_fin = float(c.get("saldo_banco") or 0) + tot_cred_banco - tot_deb_banco
    saldo_libro_fin = float(c.get("saldo_sistema") or 0) + tot_cred_sis - tot_deb_sis

    c["lineas"]          = lineas
    c["mov_sistema"]     = mov_sistema
    c["tot_cred_banco"]  = tot_cred_banco
    c["tot_deb_banco"]   = tot_deb_banco
    c["tot_cred_sis"]    = tot_cred_sis
    c["tot_deb_sis"]     = tot_deb_sis
    c["conciliadas"]     = conciliadas
    c["pendientes"]      = pendientes
    c["saldo_banco_fin"] = round(saldo_banco_fin, 2)
    c["saldo_libro_fin"] = round(saldo_libro_fin, 2)
    c["diferencia"]      = round(saldo_banco_fin - saldo_libro_fin, 2)
    return c


class LineaIn(BaseModel):
    fecha:       str
    descripcion: str
    referencia:  Optional[str] = None
    debito:      float = 0
    credito:     float = 0
    saldo:       float = 0

@router.post("/{cid}/linea")
def agregar_linea(cid: int, l: LineaIn, u=Depends(get_current_user)):
    """Agrega una linea manual del estado de cuenta del banco"""
    lid = insert("""
        INSERT INTO fin_estado_cuenta
            (conciliacion_id, fecha, descripcion, referencia,
             debito, credito, saldo, conciliado)
        VALUES (%s,%s,%s,%s,%s,%s,%s,false)
    """, (cid, l.fecha, l.descripcion, l.referencia,
          l.debito, l.credito, l.saldo))
    return {"id": lid, "msg": "Linea agregada"}


@router.delete("/linea/{lid}")
def eliminar_linea(lid: int, u=Depends(get_current_user)):
    linea = query_one("SELECT movimiento_id FROM fin_estado_cuenta WHERE id=%s",(lid,))
    if not linea: raise HTTPException(404)
    if linea["movimiento_id"]:
        raise HTTPException(400,"No se puede eliminar una linea vinculada al sistema")
    execute("DELETE FROM fin_estado_cuenta WHERE id=%s",(lid,))
    return {"msg": "Linea eliminada"}


@router.post("/{cid}/importar-csv")
async def importar_csv(cid: int, file: UploadFile, u=Depends(get_current_user)):
    """Importa lineas desde CSV: fecha,descripcion,referencia,debito,credito,saldo"""
    content_bytes = await file.read()
    lines = content_bytes.decode("utf-8-sig","replace").splitlines()
    importadas = 0
    errores    = []
    for i, line in enumerate(lines[1:], 2):  # saltar encabezado
        parts = line.split(",")
        if len(parts) < 4: continue
        try:
            fecha = parts[0].strip()
            desc  = parts[1].strip()
            ref   = parts[2].strip() if len(parts)>2 else ""
            deb   = float(parts[3].strip() or 0)
            cred  = float(parts[4].strip() or 0) if len(parts)>4 else 0
            saldo = float(parts[5].strip() or 0) if len(parts)>5 else 0
            insert("""
                INSERT INTO fin_estado_cuenta
                    (conciliacion_id, fecha, descripcion, referencia,
                     debito, credito, saldo, conciliado)
                VALUES (%s,%s,%s,%s,%s,%s,%s,false)
            """, (cid, fecha, desc, ref, deb, cred, saldo))
            importadas += 1
        except Exception as e:
            errores.append(f"Linea {i}: {str(e)}")
    return {"importadas": importadas, "errores": errores}


@router.patch("/linea/{lid}/conciliar")
def conciliar_linea(lid: int, movimiento_id: Optional[int] = None, u=Depends(get_current_user)):
    execute("""
        UPDATE fin_estado_cuenta SET conciliado=true, movimiento_id=%s WHERE id=%s
    """, (movimiento_id, lid))
    return {"msg": "Linea conciliada"}


@router.patch("/linea/{lid}/desconciliar")
def desconciliar_linea(lid: int, u=Depends(get_current_user)):
    execute("UPDATE fin_estado_cuenta SET conciliado=false WHERE id=%s",(lid,))
    return {"msg": "Desconciliada"}


@router.post("/{cid}/cerrar")
def cerrar_conciliacion(cid: int, u=Depends(get_current_user)):
    c = query_one("SELECT * FROM fin_conciliaciones WHERE id=%s",(cid,))
    if not c: raise HTTPException(404)
    pendientes = query_one("""
        SELECT COUNT(*) as n FROM fin_estado_cuenta
        WHERE conciliacion_id=%s AND conciliado=false
    """, (cid,))
    if int(pendientes["n"]) > 0:
        raise HTTPException(400,
            f"Hay {pendientes['n']} lineas sin conciliar. Concilia o elimina las partidas pendientes antes de cerrar.")

    lineas = query("SELECT * FROM fin_estado_cuenta WHERE conciliacion_id=%s",(cid,))
    saldo_b_fin = float(c.get("saldo_banco") or 0) + sum(
        float(l["credito"])-float(l["debito"]) for l in lineas if not l["movimiento_id"])
    saldo_l_fin = float(c.get("saldo_sistema") or 0) + sum(
        float(l["credito"])-float(l["debito"]) for l in lineas if l["movimiento_id"])
    diferencia = round(saldo_b_fin - saldo_l_fin, 2)

    execute("""
        UPDATE fin_conciliaciones SET
            estado='CERRADA', saldo_banco=%s,
            saldo_sistema=%s, diferencia=%s
        WHERE id=%s
    """, (round(saldo_b_fin,2), round(saldo_l_fin,2), diferencia, cid))

    # Marcar movimientos del sistema como conciliados
    execute("""
        UPDATE fin_movimientos_bancarios SET estado='CONCILIADO'
        WHERE id IN (
            SELECT movimiento_id FROM fin_estado_cuenta
            WHERE conciliacion_id=%s AND movimiento_id IS NOT NULL
        )
    """, (cid,))

    return {"msg": "Conciliacion cerrada", "diferencia": diferencia}
