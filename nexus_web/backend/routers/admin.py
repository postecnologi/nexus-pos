"""
Modulo de Administracion del Sistema — NEXUS POS
Backup/Restore, Audit Log, System Monitor.
"""
import subprocess, os, datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from database import query, query_one, execute, insert
from auth import get_current_user
from permisos import requiere_rol
from pathlib import Path
from typing import Optional

router = APIRouter(prefix="/api/admin", tags=["Administracion"])

BACKUP_DIR = Path(__file__).resolve().parent.parent.parent / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


# ══════════════════════════════════════════════════════════════
#  HELPER: Registrar accion en audit log
# ══════════════════════════════════════════════════════════════

def registrar_audit(usuario_id, usuario_nombre, accion, modulo, detalle="", ip=""):
    """Log an action to the audit trail. Safe to call from any module."""
    try:
        insert(
            "INSERT INTO sys_audit_log (usuario_id, usuario_nombre, accion, modulo, detalle, ip) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (usuario_id, usuario_nombre, accion, modulo,
             detalle[:500] if detalle else "", ip))
    except:
        pass


# ══════════════════════════════════════════════════════════════
#  BACKUPS
# ══════════════════════════════════════════════════════════════

@router.get("/backups")
def listar_backups(u=Depends(requiere_rol("admin"))):
    """List available database backups."""
    files = []
    for f in sorted(BACKUP_DIR.glob("*.sql"),
                    key=lambda x: x.stat().st_mtime, reverse=True):
        size_mb = round(f.stat().st_size / (1024 * 1024), 2)
        fecha = datetime.datetime.fromtimestamp(f.stat().st_mtime).isoformat()
        files.append({"nombre": f.name, "tamano_mb": size_mb, "fecha": fecha})
    return files


@router.post("/backups/crear")
def crear_backup(u=Depends(requiere_rol("admin"))):
    """Create a database backup using pg_dump."""
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5433")
    db_name = os.getenv("DB_NAME", "nexus_db")
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD", "")

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"nexus_backup_{timestamp}.sql"
    filepath = BACKUP_DIR / filename

    env = os.environ.copy()
    env["PGPASSWORD"] = db_pass

    # Find pg_dump
    pg_dump = "pg_dump"
    for ver in ["18","17","16","15","14","13"]:
        candidate = Path(f"C:/Program Files/PostgreSQL/{ver}/bin/pg_dump.exe")
        if candidate.exists():
            pg_dump = str(candidate)
            break

    try:
        result = subprocess.run(
            [pg_dump, "-h", db_host, "-p", str(db_port),
             "-U", db_user, "-d", db_name, "-f", str(filepath)],
            env=env, capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            raise Exception(result.stderr[:300])

        size_mb = round(filepath.stat().st_size / (1024 * 1024), 2)
        registrar_audit(u["id"], u.get("nombre", ""), "BACKUP", "admin",
                        f"Backup creado: {filename} ({size_mb} MB)")
        return {"msg": f"Backup creado: {filename}", "archivo": filename,
                "tamano_mb": size_mb}
    except FileNotFoundError:
        raise HTTPException(500,
            "pg_dump no encontrado. Instale PostgreSQL client tools.")
    except subprocess.TimeoutExpired:
        raise HTTPException(500, "Timeout al crear backup")
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)[:200]}")


@router.get("/backups/{nombre}/descargar")
def descargar_backup(nombre: str, u=Depends(requiere_rol("admin"))):
    """Download a backup file."""
    if ".." in nombre:
        raise HTTPException(400, "Nombre invalido")
    filepath = BACKUP_DIR / nombre
    if not filepath.exists():
        raise HTTPException(404, "Backup no encontrado")
    content = filepath.read_bytes()
    return Response(
        content=content, media_type="application/sql",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'})


@router.delete("/backups/{nombre}")
def eliminar_backup(nombre: str, u=Depends(requiere_rol("admin"))):
    """Delete a backup file."""
    if ".." in nombre:
        raise HTTPException(400)
    filepath = BACKUP_DIR / nombre
    if filepath.exists():
        filepath.unlink()
    registrar_audit(u["id"], u.get("nombre", ""), "ELIMINAR", "admin",
                    f"Backup eliminado: {nombre}")
    return {"msg": "Backup eliminado"}


@router.post("/backups/restaurar")
async def restaurar_backup(file: UploadFile = File(...),
                           u=Depends(requiere_rol("admin"))):
    """Restore database from uploaded SQL file. Creates safety backup first."""
    # Auto-create backup before restore
    try:
        crear_backup(u)
    except:
        pass

    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

    content = await file.read()
    temp_file = BACKUP_DIR / f"restore_temp_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    temp_file.write_bytes(content)

    env = os.environ.copy()
    env["PGPASSWORD"] = os.getenv("DB_PASSWORD", "")

    psql_cmd = "psql"
    for ver in ["18","17","16","15","14","13"]:
        candidate = Path(f"C:/Program Files/PostgreSQL/{ver}/bin/psql.exe")
        if candidate.exists():
            psql_cmd = str(candidate)
            break

    try:
        result = subprocess.run(
            [psql_cmd,
             "-h", os.getenv("DB_HOST", "localhost"),
             "-p", os.getenv("DB_PORT", "5433"),
             "-U", os.getenv("DB_USER", "postgres"),
             "-d", os.getenv("DB_NAME", "nexus_db"),
             "-f", str(temp_file)],
            env=env, capture_output=True, text=True, timeout=300
        )
        temp_file.unlink()
        registrar_audit(u["id"], u.get("nombre", ""), "RESTAURAR", "admin",
                        f"Base restaurada desde: {file.filename}")
        if result.returncode != 0:
            return {"msg": "Restauracion completada con advertencias",
                    "warnings": result.stderr[:500]}
        return {"msg": "Base de datos restaurada correctamente"}
    except Exception as e:
        if temp_file.exists():
            temp_file.unlink()
        raise HTTPException(500, f"Error: {str(e)[:200]}")


# ══════════════════════════════════════════════════════════════
#  AUDIT LOG
# ══════════════════════════════════════════════════════════════

@router.get("/audit-log")
def get_audit_log(
    usuario_id: Optional[int] = None,
    modulo: Optional[str] = None,
    accion: Optional[str] = None,
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    limit: int = 100,
    u=Depends(requiere_rol("admin", "gerente"))
):
    """Query audit log with optional filters."""
    conds = ["1=1"]
    params = []
    if usuario_id:
        conds.append("a.usuario_id=%s"); params.append(usuario_id)
    if modulo:
        conds.append("a.modulo=%s"); params.append(modulo)
    if accion:
        conds.append("a.accion=%s"); params.append(accion)
    if fecha_ini:
        conds.append("a.created_at::date>=%s"); params.append(fecha_ini)
    if fecha_fin:
        conds.append("a.created_at::date<=%s"); params.append(fecha_fin)
    where = "WHERE " + " AND ".join(conds)
    params.append(limit)
    return query(f"""
        SELECT a.*, u.username FROM sys_audit_log a
        LEFT JOIN sys_usuarios u ON u.id=a.usuario_id
        {where} ORDER BY a.created_at DESC LIMIT %s
    """, params)


@router.get("/audit-log/stats")
def audit_stats(u=Depends(requiere_rol("admin"))):
    """Audit log statistics."""
    return {
        "total": query_one(
            "SELECT COUNT(*) as n FROM sys_audit_log")["n"],
        "hoy": query_one(
            "SELECT COUNT(*) as n FROM sys_audit_log "
            "WHERE created_at::date=CURRENT_DATE")["n"],
        "por_accion": query(
            "SELECT accion, COUNT(*) as n FROM sys_audit_log "
            "GROUP BY accion ORDER BY n DESC LIMIT 10"),
        "por_usuario": query(
            "SELECT usuario_nombre, COUNT(*) as n FROM sys_audit_log "
            "GROUP BY usuario_nombre ORDER BY n DESC LIMIT 10"),
        "ultimos_errores": query(
            "SELECT * FROM sys_audit_log WHERE accion='ERROR' "
            "ORDER BY created_at DESC LIMIT 5"),
    }


# ══════════════════════════════════════════════════════════════
#  SYSTEM MONITOR
# ══════════════════════════════════════════════════════════════

@router.get("/sistema/estado")
def estado_sistema(u=Depends(requiere_rol("admin"))):
    """System health check."""
    import platform

    # Database
    try:
        query_one("SELECT 1 as ok")
        db_status = "OK"
        db_size = query_one(
            "SELECT pg_size_pretty(pg_database_size(current_database())) as size")
        tables = query_one(
            "SELECT COUNT(*) as n FROM information_schema.tables "
            "WHERE table_schema='public'")
    except Exception as e:
        db_status = f"ERROR: {str(e)[:100]}"
        db_size = {"size": "?"}
        tables = {"n": 0}

    # Disk (where backups are stored)
    try:
        import psutil
        disk = psutil.disk_usage(str(BACKUP_DIR))
        disk_info = {
            "total_gb": round(disk.total / (1024 ** 3), 1),
            "usado_gb": round(disk.used / (1024 ** 3), 1),
            "libre_gb": round(disk.free / (1024 ** 3), 1),
            "pct_usado": disk.percent,
        }
    except:
        disk_info = {"total_gb": 0, "usado_gb": 0, "libre_gb": 0,
                     "pct_usado": 0}

    # Memory
    try:
        import psutil
        mem = psutil.virtual_memory()
        mem_info = {
            "total_gb": round(mem.total / (1024 ** 3), 1),
            "usado_gb": round(mem.used / (1024 ** 3), 1),
            "pct_usado": mem.percent,
        }
    except:
        mem_info = {"total_gb": 0, "usado_gb": 0, "pct_usado": 0}

    # App info
    from main import app
    total_rutas = len([r for r in app.routes if hasattr(r, 'methods')])

    # Data counts
    try:
        counts = {
            "usuarios": query_one(
                "SELECT COUNT(*) as n FROM sys_usuarios WHERE activo=true"
            )["n"],
            "productos": query_one(
                "SELECT COUNT(*) as n FROM inv_productos WHERE activo=true"
            )["n"],
            "clientes": query_one(
                "SELECT COUNT(*) as n FROM ven_clientes WHERE activo=true"
            )["n"],
            "facturas": query_one(
                "SELECT COUNT(*) as n FROM ven_facturas WHERE estado='EMITIDA'"
            )["n"],
        }
    except:
        counts = {}

    return {
        "servidor": {
            "os": platform.system(),
            "version": platform.version(),
            "python": platform.python_version(),
        },
        "base_datos": {
            "estado": db_status,
            "tamano": db_size.get("size", "?"),
            "tablas": tables["n"],
        },
        "disco": disk_info,
        "memoria": mem_info,
        "aplicacion": {
            "version": "2.0.0",
            "endpoints": total_rutas,
            "framework": "FastAPI",
        },
        "datos": counts,
    }


@router.get("/sistema/errores-recientes")
def errores_recientes(u=Depends(requiere_rol("admin"))):
    """Recent application errors from audit log."""
    return query("""
        SELECT * FROM sys_audit_log WHERE accion='ERROR'
        ORDER BY created_at DESC LIMIT 20
    """)
