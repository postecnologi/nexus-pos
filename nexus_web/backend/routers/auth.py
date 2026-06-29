import os
from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from database import query_one, set_tenant_db, clear_tenant_db
from auth import verify_password, create_token, get_current_user
from permisos import get_permisos_efectivos

router = APIRouter(prefix="/api/auth", tags=["Auth"])

MULTI_TENANT = os.getenv("MULTI_TENANT", "false").lower() == "true"


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), empresa_codigo: str = Form("")):
    empresa_db = None

    # If multi-tenant is enabled, company code is REQUIRED
    if MULTI_TENANT:
        if not empresa_codigo or not empresa_codigo.strip():
            raise HTTPException(status_code=401, detail="Debe ingresar el codigo de empresa")
        from multitenant import get_empresa_db
        empresa_db = get_empresa_db(codigo=empresa_codigo.strip())
        if not empresa_db:
            raise HTTPException(status_code=401, detail="Empresa no encontrada o inactiva")
        set_tenant_db(empresa_db)

    try:
        user = query_one(
            "SELECT * FROM sys_usuarios WHERE username=%s AND activo=true",
            (form.username,))
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        if not verify_password(form.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Contrasena incorrecta")

        # Include empresa_db in the token so middleware can set it on subsequent requests
        token_data = {"sub": str(user["id"])}
        if empresa_db:
            token_data["empresa_db"] = empresa_db

        token = create_token(token_data)
        rol = user.get("rol") or "admin"
        permisos = get_permisos_efectivos(user["id"], rol)
        modulos_permitidos = [m for m, acc in permisos.items() if "ver" in acc]

        try:
            from routers.admin import registrar_audit
            registrar_audit(user["id"], user.get("nombre", ""), "LOGIN", "auth",
                          f"Login: {user['username']} (rol: {rol})")
        except Exception:
            pass

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id":          user["id"],
                "username":    user["username"],
                "nombre":      user["nombre"],
                "sucursal_id": user["sucursal_id"],
                "rol":         rol,
                "permisos":    permisos,
                "modulos_permitidos": modulos_permitidos,
                "empresa_db":  empresa_db,
                "empresa_codigo": empresa_codigo.strip() if empresa_codigo else None,
            }
        }
    finally:
        if empresa_db:
            clear_tenant_db()


@router.get("/me")
def me(u=Depends(get_current_user)):
    return u

@router.get("/mi-plan")
def mi_plan(u=Depends(get_current_user)):
    from database import get_current_db
    from multitenant import get_uso_empresa
    db = u.get("empresa_db") or get_current_db()
    uso = get_uso_empresa(db)
    if not uso:
        return {"plan": "Sin limite", "msg": "No aplica"}
    return uso


class SolicitudDemo(BaseModel):
    empresa_nombre: str
    ruc: str = ""
    email: str
    telefono: str
    admin_nombre: str
    giro_negocio: str = ""
    ciudad: str = ""

@router.post("/solicitar-demo")
def solicitar_demo(data: SolicitudDemo):
    """Public endpoint to request a demo. Saves lead info for follow-up."""
    from database import execute, insert
    try:
        insert("""
            INSERT INTO sys_solicitudes_demo
                (empresa_nombre, ruc, email, telefono, contacto_nombre, giro_negocio, ciudad)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (data.empresa_nombre, data.ruc, data.email, data.telefono,
              data.admin_nombre, data.giro_negocio, data.ciudad))
    except Exception:
        pass
    return {"msg": "Solicitud recibida"}


class RegistroEmpresa(BaseModel):
    empresa_nombre: str
    ruc: str = ""
    email: str
    telefono: str = ""
    admin_nombre: str
    admin_username: str
    admin_password: str
    plan: str = "BASICO"

@router.post("/registro")
def registro_publico(data: RegistroEmpresa):
    """Public self-registration endpoint. Creates a new company + admin user."""
    if not MULTI_TENANT:
        raise HTTPException(400, "Registro no disponible")

    from multitenant import create_tenant_database, get_master_connection
    import re

    if not data.empresa_nombre or not data.admin_username or not data.admin_password:
        raise HTTPException(400, "Nombre de empresa, usuario y contrasena son obligatorios")
    if len(data.admin_password) < 6:
        raise HTTPException(400, "La contrasena debe tener al menos 6 caracteres")

    codigo = re.sub(r'[^a-zA-Z0-9]', '', data.empresa_nombre)[:10].upper()
    if not codigo:
        codigo = "EMP"

    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM mt_empresas WHERE codigo=%s", (codigo,))
        if cur.fetchone():
            import uuid
            codigo = codigo[:6] + uuid.uuid4().hex[:4].upper()
    finally:
        conn.close()

    try:
        result = create_tenant_database(
            codigo=codigo, nombre=data.empresa_nombre,
            ruc=data.ruc, email=data.email,
            admin_nombre=data.admin_nombre,
            admin_username=data.admin_username,
            admin_password=data.admin_password,
            admin_email=data.email,
        )
        return {
            "msg": "Empresa registrada exitosamente",
            "codigo_empresa": codigo,
            "username": data.admin_username,
            "instrucciones": f"Use el codigo '{codigo}' para iniciar sesion",
        }
    except Exception as e:
        raise HTTPException(400, str(e))
