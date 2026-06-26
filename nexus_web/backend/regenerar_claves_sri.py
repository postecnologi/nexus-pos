import psycopg2

conn = psycopg2.connect(
    host='localhost', port=5433,
    dbname='nexus_db', user='postgres', password='nexus2024'
)
cur = conn.cursor()

# Obtener empresa
cur.execute("SELECT ruc, ambiente_sri FROM sys_empresas WHERE activa=true LIMIT 1")
emp = cur.fetchone()
if not emp:
    print("No hay empresa configurada")
    exit()

ruc_emp = (emp[0] or "9999999999999").zfill(13)
amb     = emp[1] or "1"
print(f"Empresa RUC: {ruc_emp}, Ambiente: {amb}")

cur.execute("SELECT id, numero_factura, fecha_emision FROM ven_facturas ORDER BY id")
facturas = cur.fetchall()
print(f"Facturas a procesar: {len(facturas)}")

actualizadas = 0
for fid, num_factura, fecha_emision in facturas:
    try:
        partes   = num_factura.split("-")
        cod_est  = partes[0] if len(partes)>0 else "001"
        pto_emis = partes[1] if len(partes)>1 else "001"
        seq      = partes[2] if len(partes)>2 else "000000001"

        if hasattr(fecha_emision, 'strftime'):
            fecha_e = fecha_emision.strftime("%d%m%Y")
        else:
            d = str(fecha_emision)[:10]
            y,m,day = d.split("-")
            fecha_e = f"{day}{m}{y}"

        serie6  = f"{cod_est}{pto_emis}"[:6].zfill(6)
        seq9    = seq.zfill(9)
        cod_num = str(fid).zfill(8)[-8:]
        clave48 = f"{fecha_e}01{ruc_emp}{amb}{serie6}{seq9}{cod_num}1"

        factores = ([2,3,4,5,6,7]*8)[:48]
        suma = sum(int(c)*f for c,f in zip(reversed(clave48), factores))
        r  = 11 - (suma % 11)
        dv = 0 if r==11 else (1 if r==10 else r)
        clave = clave48 + str(dv)

        print(f"  {fid} ({num_factura}): {clave}")
        cur.execute("UPDATE ven_facturas SET clave_acceso=%s WHERE id=%s", (clave, fid))
        actualizadas += 1
    except Exception as e:
        print(f"  ERROR factura {fid}: {e}")

conn.commit()
conn.close()
print(f"\n{actualizadas} facturas actualizadas correctamente")
