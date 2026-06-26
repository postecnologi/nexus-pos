import os
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from database import query_one, set_tenant_db

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain, hashed):
    if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
        return pwd_context.verify(plain, hashed)
    return plain == hashed

def hash_password(password):
    return pwd_context.hash(password)

def create_token(data: dict):
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalido")

        # If the token carries a tenant DB, set it for this request
        empresa_db = payload.get("empresa_db")
        if empresa_db:
            set_tenant_db(empresa_db)

        user = query_one(
            "SELECT id, username, nombre, sucursal_id, COALESCE(rol, 'admin') as rol FROM sys_usuarios WHERE id=%s AND activo=true",
            (int(user_id),))
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")

        # Attach empresa_db to user dict for downstream use
        if empresa_db:
            user["empresa_db"] = empresa_db

        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado o invalido")
