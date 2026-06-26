"""
Firma digital de comprobantes electrónicos SRI
Usa la librería xades (XAdES-BES) para firmar XML con certificado .p12
"""
import os
import base64
import tempfile
from pathlib import Path

CERT_DIR = Path(__file__).resolve().parent.parent.parent / "certificados"
CERT_DIR.mkdir(parents=True, exist_ok=True)


def get_cert_path() -> Path | None:
    for f in CERT_DIR.iterdir():
        if f.suffix.lower() == ".p12":
            return f
    return None


def firmar_xml(xml_str: str, p12_path: str = None, p12_password: str = None) -> str:
    """
    Firma un XML con el certificado .p12.
    Retorna el XML firmado como string.

    Requiere: pip install xades signxml lxml cryptography
    Si no están instaladas, retorna el XML sin firmar con un warning.
    """
    if not p12_path:
        cert = get_cert_path()
        if not cert:
            raise FileNotFoundError(
                "No se encontró certificado .p12 en la carpeta 'certificados/'. "
                "Suba el certificado desde Configuración > SRI."
            )
        p12_path = str(cert)

    if not p12_password:
        p12_password = os.getenv("SRI_P12_PASSWORD", "")

    if not p12_password:
        raise ValueError("No se configuró la contraseña del certificado .p12 (SRI_P12_PASSWORD)")

    try:
        from lxml import etree
        from cryptography.hazmat.primitives.serialization import pkcs12
        from cryptography.hazmat.primitives import serialization
        from signxml import XMLSigner, methods
    except ImportError:
        raise ImportError(
            "Faltan dependencias para firma electrónica. "
            "Ejecute: pip install lxml signxml cryptography"
        )

    with open(p12_path, "rb") as f:
        p12_data = f.read()

    private_key, certificate, ca_certs = pkcs12.load_key_and_certificates(
        p12_data, p12_password.encode("utf-8")
    )

    key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    cert_pem = certificate.public_bytes(serialization.Encoding.PEM)

    root = etree.fromstring(xml_str.encode("utf-8") if isinstance(xml_str, str) else xml_str)

    signer = XMLSigner(
        method=methods.enveloped,
        signature_algorithm="rsa-sha1",
        digest_algorithm="sha1",
        c14n_algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    )

    signed_root = signer.sign(
        root,
        key=key_pem,
        cert=cert_pem,
    )

    return etree.tostring(signed_root, pretty_print=True, xml_declaration=True,
                          encoding="UTF-8").decode("utf-8")


def guardar_certificado(p12_bytes: bytes, filename: str) -> Path:
    """Guarda un certificado .p12 subido desde el frontend."""
    for f in CERT_DIR.iterdir():
        if f.suffix.lower() == ".p12":
            f.unlink()
    dest = CERT_DIR / filename
    dest.write_bytes(p12_bytes)
    return dest


def verificar_certificado(p12_path: str = None, p12_password: str = None) -> dict:
    """Verifica que el certificado .p12 sea válido y retorna info."""
    if not p12_path:
        cert = get_cert_path()
        if not cert:
            return {"valido": False, "error": "No hay certificado .p12"}
        p12_path = str(cert)

    if not p12_password:
        p12_password = os.getenv("SRI_P12_PASSWORD", "")

    try:
        from cryptography.hazmat.primitives.serialization import pkcs12

        with open(p12_path, "rb") as f:
            p12_data = f.read()

        private_key, certificate, ca_certs = pkcs12.load_key_and_certificates(
            p12_data, p12_password.encode("utf-8")
        )

        return {
            "valido": True,
            "sujeto": certificate.subject.rfc4514_string(),
            "emisor": certificate.issuer.rfc4514_string(),
            "valido_desde": certificate.not_valid_before_utc.isoformat(),
            "valido_hasta": certificate.not_valid_after_utc.isoformat(),
            "serial": str(certificate.serial_number),
            "archivo": Path(p12_path).name,
        }
    except Exception as e:
        return {"valido": False, "error": str(e)}
