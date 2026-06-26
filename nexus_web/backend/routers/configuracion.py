from fastapi import APIRouter, Depends, HTTPException, Request
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/config", tags=["Configuracion"])


# ── EMPRESA ───────────────────────────────────────────────
@router.get("/empresa")
def get_empresa(u=Depends(get_current_user)):
    return query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")

class EmpresaIn(BaseModel):
    ruc:                    str
    razon_social:           str
    nombre_comercial:       Optional[str] = None
    direccion:              Optional[str] = None
    telefono:               Optional[str] = None
    email:                  Optional[str] = None
    website:                Optional[str] = None
    representante_legal:    Optional[str] = None
    contribuyente_tipo:     Optional[str] = "NATURAL"
    obligado_contabilidad:  bool = False
    regimen:                Optional[str] = "GENERAL"
    iva_porcentaje:         float = 15.0
    ambiente_sri:           Optional[str] = "1"
    moneda:                 Optional[str] = "DOLAR"

@router.put("/empresa")
def actualizar_empresa(e: EmpresaIn, u=Depends(get_current_user)):
    emp = query_one("SELECT id FROM sys_empresas WHERE activa=true LIMIT 1")
    if emp:
        execute("""
            UPDATE sys_empresas SET
                ruc=%s, razon_social=%s, nombre_comercial=%s,
                direccion=%s, telefono=%s, email=%s, website=%s,
                representante_legal=%s, contribuyente_tipo=%s,
                obligado_contabilidad=%s, regimen=%s, iva_porcentaje=%s,
                ambiente_sri=%s, moneda=%s
            WHERE id=%s
        """, (e.ruc, e.razon_social, e.nombre_comercial, e.direccion,
              e.telefono, e.email, e.website, e.representante_legal,
              e.contribuyente_tipo, e.obligado_contabilidad, e.regimen,
              e.iva_porcentaje, e.ambiente_sri, e.moneda, emp["id"]))
    else:
        insert("""
            INSERT INTO sys_empresas
            (ruc, razon_social, nombre_comercial, direccion, telefono,
             email, website, representante_legal, contribuyente_tipo,
             obligado_contabilidad, regimen, iva_porcentaje,
             ambiente_sri, moneda, activa)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,true)
        """, (e.ruc, e.razon_social, e.nombre_comercial, e.direccion,
              e.telefono, e.email, e.website, e.representante_legal,
              e.contribuyente_tipo, e.obligado_contabilidad, e.regimen,
              e.iva_porcentaje, e.ambiente_sri, e.moneda))
    return {"msg": "Empresa actualizada"}



@router.post("/empresa/logo")
async def subir_logo(
    request: Request,
    u=Depends(get_current_user)
):
    """Recibe el logo como base64 y lo guarda en sys_empresas"""
    body = await request.json()
    logo_b64 = body.get("logo_base64", "")
    if not logo_b64:
        raise HTTPException(400, "No se recibió imagen")
    # Validar tamaño máximo 2MB en base64 (~2.7MB string)
    if len(logo_b64) > 3_000_000:
        raise HTTPException(400, "La imagen es muy grande. Máximo 2MB.")
    emp = query_one("SELECT id FROM sys_empresas WHERE activa=true LIMIT 1")
    if not emp:
        raise HTTPException(404, "No hay empresa configurada")
    execute(
        "UPDATE sys_empresas SET logo_base64=%s WHERE id=%s",
        (logo_b64, emp["id"])
    )
    return {"msg": "Logo actualizado correctamente"}

@router.delete("/empresa/logo")
def eliminar_logo(u=Depends(get_current_user)):
    emp = query_one("SELECT id FROM sys_empresas WHERE activa=true LIMIT 1")
    if emp:
        execute("UPDATE sys_empresas SET logo_base64=NULL WHERE id=%s", (emp["id"],))
    return {"msg": "Logo eliminado"}

# ── SUCURSALES ────────────────────────────────────────────
@router.get("/sucursales")
def get_sucursales_config(u=Depends(get_current_user)):
    return query("""
        SELECT s.*,
               COUNT(b.id) as num_bodegas,
               COUNT(v.id) as num_vendedores
        FROM sys_sucursales s
        LEFT JOIN inv_bodegas b ON b.sucursal_id=s.id AND b.activa=true
        LEFT JOIN ven_vendedores v ON v.sucursal_id=s.id AND v.activo=true
        GROUP BY s.id ORDER BY s.es_principal DESC, s.nombre
    """)

class SucursalIn(BaseModel):
    codigo:                   str
    nombre:                   str
    direccion:                Optional[str] = None
    ciudad:                   Optional[str] = None
    provincia:                Optional[str] = None
    pais:                     Optional[str] = "Ecuador"
    telefono:                 Optional[str] = None
    email:                    Optional[str] = None
    codigo_establecimiento:   Optional[str] = "001"
    punto_emision:            Optional[str] = "001"
    contribuyente_especial:   Optional[str] = None
    obligado_contabilidad:    bool = False
    es_principal:             bool = False
    meta_mensual_vendedores:  float = 0
    activa:                   bool = True
    # Secuenciales SRI
    secuencial_factura:       int = 1
    secuencial_nc:            int = 1
    secuencial_nota_debito:   int = 1
    secuencial_retencion:     int = 1
    secuencial_guia_remision: int = 1
    secuencial_liquidacion:   int = 1

@router.post("/sucursales")
def crear_sucursal(s: SucursalIn, u=Depends(get_current_user)):
    emp = query_one("SELECT id FROM sys_empresas WHERE activa=true LIMIT 1")
    if not emp: raise HTTPException(400, "Configura primero la empresa")
    sid = insert("""
        INSERT INTO sys_sucursales
        (empresa_id, codigo, nombre, direccion, ciudad, provincia, pais,
         telefono, email, codigo_establecimiento, punto_emision,
         contribuyente_especial, obligado_contabilidad, es_principal,
         meta_mensual_vendedores, activa,
         secuencial_factura, secuencial_nc, secuencial_nota_debito,
         secuencial_retencion, secuencial_guia_remision, secuencial_liquidacion)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (emp["id"], s.codigo, s.nombre, s.direccion, s.ciudad, s.provincia,
          s.pais, s.telefono, s.email, s.codigo_establecimiento, s.punto_emision,
          s.contribuyente_especial, s.obligado_contabilidad, s.es_principal,
          s.meta_mensual_vendedores, s.activa,
          s.secuencial_factura, s.secuencial_nc, s.secuencial_nota_debito,
          s.secuencial_retencion, s.secuencial_guia_remision, s.secuencial_liquidacion))
    return {"id": sid, "msg": "Sucursal creada"}

@router.put("/sucursales/{sid}")
def actualizar_sucursal(sid: int, s: SucursalIn, u=Depends(get_current_user)):
    execute("""
        UPDATE sys_sucursales SET
            codigo=%s, nombre=%s, direccion=%s, ciudad=%s, provincia=%s,
            pais=%s, telefono=%s, email=%s, codigo_establecimiento=%s,
            punto_emision=%s, contribuyente_especial=%s,
            obligado_contabilidad=%s, es_principal=%s,
            meta_mensual_vendedores=%s, activa=%s,
            secuencial_factura=%s, secuencial_nc=%s, secuencial_nota_debito=%s,
            secuencial_retencion=%s, secuencial_guia_remision=%s, secuencial_liquidacion=%s
        WHERE id=%s
    """, (s.codigo, s.nombre, s.direccion, s.ciudad, s.provincia,
          s.pais, s.telefono, s.email, s.codigo_establecimiento,
          s.punto_emision, s.contribuyente_especial, s.obligado_contabilidad,
          s.es_principal, s.meta_mensual_vendedores, s.activa,
          s.secuencial_factura, s.secuencial_nc, s.secuencial_nota_debito,
          s.secuencial_retencion, s.secuencial_guia_remision, s.secuencial_liquidacion, sid))
    return {"msg": "Sucursal actualizada"}

@router.patch("/sucursales/{sid}/toggle")
def toggle_sucursal(sid: int, u=Depends(get_current_user)):
    s = query_one("SELECT activa FROM sys_sucursales WHERE id=%s", (sid,))
    if not s: raise HTTPException(404)
    execute("UPDATE sys_sucursales SET activa=%s WHERE id=%s", (not s["activa"], sid))
    return {"activa": not s["activa"]}

# ── BODEGAS ───────────────────────────────────────────────
@router.get("/bodegas")
def get_bodegas_config(u=Depends(get_current_user)):
    return query("""
        SELECT b.*, s.nombre as sucursal_nombre,
               COALESCE(
                   (SELECT SUM(st.cantidad) FROM inv_stock st
                    WHERE st.bodega_id=b.id), 0
               ) as total_stock
        FROM inv_bodegas b
        LEFT JOIN sys_sucursales s ON s.id=b.sucursal_id
        ORDER BY s.nombre, b.es_principal DESC, b.nombre
    """)

class BodegaIn(BaseModel):
    sucursal_id:  Optional[int] = None
    nombre:       str
    descripcion:  Optional[str] = None
    direccion:    Optional[str] = None
    responsable:  Optional[str] = None
    telefono:     Optional[str] = None
    es_principal: bool = False
    activa:       bool = True

@router.post("/bodegas")
def crear_bodega(b: BodegaIn, u=Depends(get_current_user)):
    bid = insert("""
        INSERT INTO inv_bodegas
        (sucursal_id, nombre, descripcion, direccion,
         responsable, telefono, es_principal, activa)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, (b.sucursal_id, b.nombre, b.descripcion, b.direccion,
          b.responsable, b.telefono, b.es_principal, b.activa))
    return {"id": bid, "msg": "Bodega creada"}

@router.put("/bodegas/{bid}")
def actualizar_bodega(bid: int, b: BodegaIn, u=Depends(get_current_user)):
    execute("""
        UPDATE inv_bodegas SET
            sucursal_id=%s, nombre=%s, descripcion=%s, direccion=%s,
            responsable=%s, telefono=%s, es_principal=%s, activa=%s
        WHERE id=%s
    """, (b.sucursal_id, b.nombre, b.descripcion, b.direccion,
          b.responsable, b.telefono, b.es_principal, b.activa, bid))
    return {"msg": "Bodega actualizada"}

@router.patch("/bodegas/{bid}/toggle")
def toggle_bodega(bid: int, u=Depends(get_current_user)):
    b = query_one("SELECT activa FROM inv_bodegas WHERE id=%s", (bid,))
    if not b: raise HTTPException(404)
    execute("UPDATE inv_bodegas SET activa=%s WHERE id=%s", (not b["activa"], bid))
    return {"activa": not b["activa"]}

# ── SECUENCIALES POR SUCURSAL ─────────────────────────────
@router.get("/sucursales/{sid}/secuenciales")
def get_secuenciales(sid: int, u=Depends(get_current_user)):
    return query_one("""
        SELECT id, nombre, punto_emision, codigo_establecimiento,
               COALESCE(secuencial_factura, 1)       as secuencial_factura,
               COALESCE(secuencial_nc, 1)             as secuencial_nc,
               COALESCE(secuencial_nota_debito, 1)    as secuencial_nota_debito,
               COALESCE(secuencial_retencion, 1)      as secuencial_retencion,
               COALESCE(secuencial_guia_remision, 1)  as secuencial_guia_remision,
               COALESCE(secuencial_liquidacion, 1)    as secuencial_liquidacion
        FROM sys_sucursales WHERE id=%s
    """, (sid,))

class SecuencialesIn(BaseModel):
    secuencial_factura:      int = 1
    secuencial_nc:           int = 1
    secuencial_nota_debito:  int = 1
    secuencial_retencion:    int = 1
    secuencial_guia_remision:int = 1
    secuencial_liquidacion:  int = 1

@router.put("/sucursales/{sid}/secuenciales")
def actualizar_secuenciales(sid: int, s: SecuencialesIn, u=Depends(get_current_user)):
    execute("""
        UPDATE sys_sucursales SET
            secuencial_factura=%s,
            secuencial_nc=%s,
            secuencial_nota_debito=%s,
            secuencial_retencion=%s,
            secuencial_guia_remision=%s,
            secuencial_liquidacion=%s
        WHERE id=%s
    """, (s.secuencial_factura, s.secuencial_nc, s.secuencial_nota_debito,
          s.secuencial_retencion, s.secuencial_guia_remision,
          s.secuencial_liquidacion, sid))
    return {"msg": "Secuenciales actualizados"}
