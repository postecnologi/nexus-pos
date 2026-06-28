from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user, hash_password
from permisos import PLANTILLAS_ROL, MODULOS, ACCIONES, requiere_rol, get_permisos_usuario, get_permisos_efectivos
from routers.admin import registrar_audit
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])


@router.get("/roles")
def get_roles(u=Depends(get_current_user)):
    """Lista los roles con permisos granulares por módulo."""
    return [
        {"id": k, "nombre": v["nombre"], "descripcion": v["descripcion"],
         "permisos": v["permisos"]}
        for k, v in PLANTILLAS_ROL.items()
    ]


@router.get("/modulos")
def get_modulos(u=Depends(get_current_user)):
    """Lista todos los módulos y las acciones disponibles."""
    return {"modulos": MODULOS, "acciones": ACCIONES}


@router.get("/mi-perfil")
def mi_perfil(u=Depends(get_current_user)):
    """Devuelve el perfil y permisos del usuario actual."""
    user = query_one("""
        SELECT u.id, u.username, u.nombre, u.email, u.telefono,
               u.sucursal_id, COALESCE(u.rol,'admin') as rol, u.activo,
               s.nombre as sucursal_nombre
        FROM sys_usuarios u
        LEFT JOIN sys_sucursales s ON s.id = u.sucursal_id
        WHERE u.id=%s
    """, (u["id"],))
    if not user:
        raise HTTPException(404)
    permisos = get_permisos_efectivos(user["id"], user["rol"])
    modulos_permitidos = [m for m, acc in permisos.items() if "ver" in acc]
    return {**user, "permisos": permisos, "modulos_permitidos": modulos_permitidos}


@router.get("")
def get_usuarios(
    busqueda: Optional[str] = None,
    activo: Optional[str] = None,
    u=Depends(requiere_rol("admin", "gerente"))
):
    conds = []
    params = []
    if activo == "true":
        conds.append("u.activo=true")
    elif activo == "false":
        conds.append("u.activo=false")
    if busqueda:
        conds.append("(u.nombre ILIKE %s OR u.username ILIKE %s OR u.email ILIKE %s)")
        params += [f"%{busqueda}%"] * 3
    where = "WHERE " + " AND ".join(conds) if conds else ""
    return query(f"""
        SELECT u.id, u.username, u.nombre, u.email, u.telefono,
               u.sucursal_id, COALESCE(u.rol,'admin') as rol,
               u.activo, u.created_at,
               s.nombre as sucursal_nombre
        FROM sys_usuarios u
        LEFT JOIN sys_sucursales s ON s.id = u.sucursal_id
        {where}
        ORDER BY u.nombre
    """, params)


@router.get("/{uid}")
def get_usuario(uid: int, u=Depends(requiere_rol("admin", "gerente"))):
    user = query_one("""
        SELECT u.id, u.username, u.nombre, u.email, u.telefono,
               u.sucursal_id, COALESCE(u.rol,'admin') as rol,
               u.activo, u.created_at,
               s.nombre as sucursal_nombre
        FROM sys_usuarios u
        LEFT JOIN sys_sucursales s ON s.id = u.sucursal_id
        WHERE u.id=%s
    """, (uid,))
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    permisos_db = get_permisos_usuario(uid)
    permisos = get_permisos_efectivos(uid, user["rol"])
    user["permisos"] = permisos
    user["permisos_personalizados"] = permisos_db is not None
    return user


class UsuarioIn(BaseModel):
    username:     str
    nombre:       str
    email:        Optional[str] = None
    telefono:     Optional[str] = None
    sucursal_id:  Optional[int] = None
    rol:          str = "vendedor"
    activo:       bool = True
    password:     Optional[str] = None


@router.post("")
def crear_usuario(usr: UsuarioIn, u=Depends(requiere_rol("admin"))):
    from multitenant import verificar_limite
    ok, msg = verificar_limite(u.get("empresa_db", ""), 'usuarios')
    if not ok:
        raise HTTPException(403, msg)
    if not usr.password or len(usr.password) < 4:
        raise HTTPException(400, "La contraseña debe tener al menos 4 caracteres")
    if usr.rol not in PLANTILLAS_ROL:
        raise HTTPException(400, f"Rol inválido. Opciones: {', '.join(PLANTILLAS_ROL.keys())}")
    existe = query_one(
        "SELECT id FROM sys_usuarios WHERE username=%s", (usr.username,))
    if existe:
        raise HTTPException(400, "Ya existe un usuario con ese nombre de usuario")

    uid = insert("""
        INSERT INTO sys_usuarios
            (username, nombre, email, telefono, sucursal_id, rol,
             password_hash, activo, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW())
    """, (usr.username, usr.nombre, usr.email, usr.telefono,
          usr.sucursal_id, usr.rol, hash_password(usr.password), usr.activo))
    registrar_audit(u["id"], u.get("nombre",""), "CREAR", "usuarios", f"Usuario creado: {usr.username} (rol: {usr.rol})")
    return {"id": uid, "msg": "Usuario creado"}


@router.put("/{uid}")
def actualizar_usuario(uid: int, usr: UsuarioIn, u=Depends(requiere_rol("admin"))):
    if usr.rol not in PLANTILLAS_ROL:
        raise HTTPException(400, f"Rol inválido. Opciones: {', '.join(PLANTILLAS_ROL.keys())}")
    existe = query_one(
        "SELECT id FROM sys_usuarios WHERE username=%s AND id!=%s",
        (usr.username, uid))
    if existe:
        raise HTTPException(400, "Ya existe otro usuario con ese nombre de usuario")

    execute("""
        UPDATE sys_usuarios SET
            username=%s, nombre=%s, email=%s, telefono=%s,
            sucursal_id=%s, rol=%s, activo=%s
        WHERE id=%s
    """, (usr.username, usr.nombre, usr.email, usr.telefono,
          usr.sucursal_id, usr.rol, usr.activo, uid))
    return {"msg": "Usuario actualizado"}


class CambioPassIn(BaseModel):
    password: str

@router.patch("/{uid}/password")
def cambiar_password(uid: int, body: CambioPassIn, u=Depends(requiere_rol("admin"))):
    if len(body.password) < 4:
        raise HTTPException(400, "Mínimo 4 caracteres")
    usr_info = query_one("SELECT username FROM sys_usuarios WHERE id=%s", (uid,))
    execute(
        "UPDATE sys_usuarios SET password_hash=%s WHERE id=%s",
        (hash_password(body.password), uid))
    registrar_audit(u["id"], u.get("nombre",""), "EDITAR", "usuarios", f"Contrasena cambiada: {usr_info['username'] if usr_info else uid}")
    return {"msg": "Contraseña actualizada"}


@router.delete("/{uid}")
def eliminar_usuario(uid: int, u=Depends(requiere_rol("admin"))):
    user = query_one("SELECT id, username, rol FROM sys_usuarios WHERE id=%s", (uid,))
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if uid == u["id"]:
        raise HTTPException(400, "No puedes eliminarte a ti mismo")
    if user.get("rol") == "admin":
        otros_admin = query_one("SELECT COUNT(*) as n FROM sys_usuarios WHERE rol='admin' AND activo=true AND id!=%s", (uid,))
        if not otros_admin or int(otros_admin["n"]) == 0:
            raise HTTPException(400, "No se puede eliminar el unico administrador")
    execute("DELETE FROM sys_permisos_usuario WHERE usuario_id=%s", (uid,))
    execute("DELETE FROM sys_usuarios WHERE id=%s", (uid,))
    registrar_audit(u["id"], u.get("nombre",""), "ELIMINAR", "usuarios", f"Usuario eliminado: {user['username']}")
    return {"msg": f"Usuario '{user['username']}' eliminado"}

@router.patch("/{uid}/toggle")
def toggle_usuario(uid: int, u=Depends(requiere_rol("admin"))):
    if uid == u["id"]:
        raise HTTPException(400, "No puedes desactivarte a ti mismo")
    user = query_one("SELECT activo FROM sys_usuarios WHERE id=%s", (uid,))
    if not user:
        raise HTTPException(404)
    nuevo = not user["activo"]
    execute("UPDATE sys_usuarios SET activo=%s WHERE id=%s", (nuevo, uid))
    usr_info = query_one("SELECT username FROM sys_usuarios WHERE id=%s", (uid,))
    registrar_audit(u["id"], u.get("nombre",""), "EDITAR", "usuarios", f"Usuario {usr_info['username'] if usr_info else uid} {'activado' if nuevo else 'desactivado'}")
    return {"activo": nuevo}


class MiPerfilIn(BaseModel):
    nombre:   Optional[str] = None
    email:    Optional[str] = None
    telefono: Optional[str] = None

@router.put("/mi-perfil/actualizar")
def actualizar_mi_perfil(body: MiPerfilIn, u=Depends(get_current_user)):
    """Permite al usuario actualizar su propio perfil (sin cambiar rol ni usuario)."""
    fields = []
    params = []
    if body.nombre is not None:
        fields.append("nombre=%s"); params.append(body.nombre)
    if body.email is not None:
        fields.append("email=%s"); params.append(body.email)
    if body.telefono is not None:
        fields.append("telefono=%s"); params.append(body.telefono)
    if not fields:
        return {"msg": "Sin cambios"}
    params.append(u["id"])
    execute(f"UPDATE sys_usuarios SET {','.join(fields)} WHERE id=%s", params)
    return {"msg": "Perfil actualizado"}


class CambioMiPassIn(BaseModel):
    password_actual: str
    password_nueva:  str

@router.patch("/mi-perfil/password")
def cambiar_mi_password(body: CambioMiPassIn, u=Depends(get_current_user)):
    """Permite al usuario cambiar su propia contraseña."""
    if len(body.password_nueva) < 4:
        raise HTTPException(400, "Mínimo 4 caracteres")
    from auth import verify_password
    user = query_one("SELECT password_hash FROM sys_usuarios WHERE id=%s", (u["id"],))
    if not verify_password(body.password_actual, user["password_hash"]):
        raise HTTPException(400, "Contraseña actual incorrecta")
    execute(
        "UPDATE sys_usuarios SET password_hash=%s WHERE id=%s",
        (hash_password(body.password_nueva), u["id"]))
    return {"msg": "Contraseña actualizada"}


# ══════════════════════════════════════════════════════════════
#  PERMISOS POR USUARIO
# ══════════════════════════════════════════════════════════════

@router.get("/{uid}/permisos")
def get_permisos(uid: int, u=Depends(requiere_rol("admin"))):
    """Devuelve permisos granulares {modulo: [acciones]} para un usuario."""
    user = query_one("SELECT COALESCE(rol,'vendedor') as rol FROM sys_usuarios WHERE id=%s", (uid,))
    if not user:
        raise HTTPException(404)
    permisos_db = get_permisos_usuario(uid)
    permisos = get_permisos_efectivos(uid, user["rol"])
    return {
        "usuario_id": uid,
        "permisos": permisos,
        "personalizado": permisos_db is not None,
    }


class PermisosIn(BaseModel):
    permisos: dict  # {modulo: [acciones]}

@router.post("/{uid}/permisos")
def guardar_permisos(uid: int, body: PermisosIn, u=Depends(requiere_rol("admin"))):
    """Guarda permisos granulares {modulo: [acciones]} por usuario."""
    user = query_one("SELECT id FROM sys_usuarios WHERE id=%s", (uid,))
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    execute("DELETE FROM sys_permisos_usuario WHERE usuario_id=%s", (uid,))
    count = 0
    for modulo, acciones in body.permisos.items():
        if not acciones:
            continue
        acciones_str = ",".join(a for a in acciones if a in ACCIONES)
        if acciones_str:
            try:
                insert(
                    "INSERT INTO sys_permisos_usuario (usuario_id, modulo, acciones) VALUES (%s,%s,%s)",
                    (uid, modulo, acciones_str))
                count += 1
            except:
                pass
    usr_info = query_one("SELECT username FROM sys_usuarios WHERE id=%s", (uid,))
    modulos_asignados = [m for m, a in body.permisos.items() if a]
    modulos_quitados = [m["id"] for m in MODULOS if m["id"] not in modulos_asignados]
    detalle = f"Permisos de {usr_info['username'] if usr_info else uid}: {count} modulos. "
    if modulos_quitados:
        detalle += f"Sin acceso: {', '.join(modulos_quitados[:10])}"
    registrar_audit(u["id"], u.get("nombre",""), "EDITAR", "permisos", detalle)
    return {"msg": f"Permisos actualizados: {count} módulos"}


@router.delete("/{uid}/permisos")
def resetear_permisos(uid: int, u=Depends(requiere_rol("admin"))):
    """Elimina permisos personalizados y vuelve a usar la plantilla del rol."""
    execute("DELETE FROM sys_permisos_usuario WHERE usuario_id=%s", (uid,))
    return {"msg": "Permisos reseteados a la plantilla del rol"}
