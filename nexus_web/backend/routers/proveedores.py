from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import query, query_one, execute, insert
from auth import get_current_user

router = APIRouter(prefix="/api/proveedores", tags=["Proveedores"])


class ProveedorIn(BaseModel):
    tipo_identificacion:    str = "RUC"
    identificacion:         str
    razon_social:           str
    nombre_comercial:       Optional[str] = None
    nombres:                Optional[str] = None
    apellidos:              Optional[str] = None
    telefono:               Optional[str] = None
    email:                  Optional[str] = None
    direccion:              Optional[str] = None
    ciudad:                 Optional[str] = None
    provincia:              Optional[str] = None
    pais:                   Optional[str] = "Ecuador"
    codigo_pais:            Optional[str] = "593"
    direccion_matriz:       Optional[str] = None
    tipo_contribuyente:     Optional[str] = "JURIDICA"
    obligado_contabilidad:  bool = False
    contribuyente_especial: Optional[str] = None
    tipo_proveedor:         Optional[str] = "BIENES"
    contacto_nombre:        Optional[str] = None
    contacto_telefono:      Optional[str] = None
    contacto_email:         Optional[str] = None
    plazo_pago:             int = 0
    limite_credito:         float = 0
    activo:                 bool = True


@router.get("")
def get_proveedores(
    busqueda: str = "",
    activo: Optional[str] = "true",
    u=Depends(get_current_user)
):
    conds=[]; params=[]
    if activo=="true":    conds.append("activo=true")
    elif activo=="false": conds.append("activo=false")
    if busqueda:
        conds.append("(razon_social ILIKE %s OR identificacion ILIKE %s OR telefono ILIKE %s OR email ILIKE %s)")
        params += [f"%{busqueda}%"]*4
    where = "WHERE "+" AND ".join(conds) if conds else ""
    return query(f"""
        SELECT * FROM com_proveedores {where}
        ORDER BY razon_social LIMIT 200
    """, params)


@router.get("/{pid}")
def get_proveedor(pid: int, u=Depends(get_current_user)):
    p = query_one("SELECT * FROM com_proveedores WHERE id=%s", (pid,))
    if not p: raise HTTPException(404, "Proveedor no encontrado")
    return p


@router.post("")
def crear_proveedor(p: ProveedorIn, u=Depends(get_current_user)):
    existe = query_one(
        "SELECT id FROM com_proveedores WHERE identificacion=%s", (p.identificacion,))
    if existe: raise HTTPException(400, "Ya existe un proveedor con esa identificación")
    pid = insert("""
        INSERT INTO com_proveedores
        (tipo_identificacion, identificacion, razon_social, nombre_comercial,
         nombres, apellidos, telefono, email, direccion, ciudad, provincia,
         pais, codigo_pais, direccion_matriz, tipo_contribuyente,
         obligado_contabilidad, contribuyente_especial, tipo_proveedor,
         contacto_nombre, contacto_telefono, contacto_email,
         plazo_pago, limite_credito, activo, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP)
    """, (p.tipo_identificacion, p.identificacion, p.razon_social, p.nombre_comercial,
          p.nombres, p.apellidos, p.telefono, p.email, p.direccion, p.ciudad,
          p.provincia, p.pais, p.codigo_pais, p.direccion_matriz,
          p.tipo_contribuyente, p.obligado_contabilidad, p.contribuyente_especial,
          p.tipo_proveedor, p.contacto_nombre, p.contacto_telefono, p.contacto_email,
          p.plazo_pago, p.limite_credito, p.activo))
    return {"id": pid, "msg": "Proveedor creado"}


@router.put("/{pid}")
def actualizar_proveedor(pid: int, p: ProveedorIn, u=Depends(get_current_user)):
    existe = query_one(
        "SELECT id FROM com_proveedores WHERE identificacion=%s AND id!=%s",
        (p.identificacion, pid))
    if existe: raise HTTPException(400, "Ya existe otro proveedor con esa identificación")
    execute("""
        UPDATE com_proveedores SET
            tipo_identificacion=%s, identificacion=%s, razon_social=%s,
            nombre_comercial=%s, nombres=%s, apellidos=%s, telefono=%s,
            email=%s, direccion=%s, ciudad=%s, provincia=%s, pais=%s,
            codigo_pais=%s, direccion_matriz=%s, tipo_contribuyente=%s,
            obligado_contabilidad=%s, contribuyente_especial=%s, tipo_proveedor=%s,
            contacto_nombre=%s, contacto_telefono=%s, contacto_email=%s,
            plazo_pago=%s, limite_credito=%s, activo=%s
        WHERE id=%s
    """, (p.tipo_identificacion, p.identificacion, p.razon_social, p.nombre_comercial,
          p.nombres, p.apellidos, p.telefono, p.email, p.direccion, p.ciudad,
          p.provincia, p.pais, p.codigo_pais, p.direccion_matriz,
          p.tipo_contribuyente, p.obligado_contabilidad, p.contribuyente_especial,
          p.tipo_proveedor, p.contacto_nombre, p.contacto_telefono, p.contacto_email,
          p.plazo_pago, p.limite_credito, p.activo, pid))
    return {"msg": "Proveedor actualizado"}


@router.patch("/{pid}/toggle")
def toggle_proveedor(pid: int, u=Depends(get_current_user)):
    p = query_one("SELECT activo FROM com_proveedores WHERE id=%s", (pid,))
    if not p: raise HTTPException(404, "No encontrado")
    execute("UPDATE com_proveedores SET activo=%s WHERE id=%s", (not p["activo"], pid))
    return {"activo": not p["activo"]}
