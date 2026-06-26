import os
from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.security import OAuth2PasswordRequestForm
from database import query_one, set_tenant_db, clear_tenant_db
from auth import verify_password, create_token, get_current_user
from permisos import get_permisos_efectivos

router = APIRouter(prefix="/api/auth", tags=["Auth"])

MULTI_TENANT = os.getenv("MULTI_TENANT", "false").lower() == "true"


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), empresa_codigo: str = Form("")):
    empresa_db = None

    # If multi-tenant is enabled and a company code was provided, resolve the DB
    if MULTI_TENANT and empresa_codigo and empresa_codigo.strip():
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
