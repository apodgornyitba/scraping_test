import logging

logger = logging.getLogger(__name__)

def clean_currency(val_str):
    """Limpia los caracteres de moneda y devuelve un float."""
    if not val_str:
        return 0.0
    clean = val_str.replace("$", "").replace("\xa0", "").replace(" ", "").strip()
    if not clean or clean == "-":
        return 0.0
    # Reemplazar puntos de miles por vacío y comas decimales por puntos
    clean = clean.replace(".", "").replace(",", ".")
    try:
        return float(clean)
    except ValueError:
        logger.warning(f"No se pudo parsear el valor monetario: '{val_str}' -> '{clean}'")
        return 0.0

def parse_taxpayer_metadata(text, username):
    """Extrae metadatos estructurados del texto del dashboard principal."""
    metadata = {
        "usuario": username,
        "nombre": "Desconocido",
        "cuit": "Desconocido",
        "actividad": None,
        "regimen": None,
        "forma_juridica": None,
        "agencia": None,
        "email": None,
        "domicilio": None,
        "riesgo_fiscal": None,
        "score_cumplimiento": None,
        "embargos_activos": None,
        "mesa_fiscalizacion": None
    }
    
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Dividir por el separador '|'
        parts = [p.strip() for p in line.split("|")]
        for part in parts:
            if ":" in part:
                key, val = part.split(":", 1)
                key = key.strip().lower()
                val = val.strip()
                if "contribuyente" in key:
                    metadata["nombre"] = val
                elif "cuit" in key:
                    metadata["cuit"] = val
                elif "actividad" in key:
                    metadata["actividad"] = val
                elif "regimen" in key or "régimen" in key:
                    metadata["regimen"] = val
                elif "forma juridica" in key or "forma jurídica" in key:
                    metadata["forma_juridica"] = val
                elif "agencia" in key:
                    metadata["agencia"] = val
                elif "domicilio fiscal" in key:
                    metadata["domicilio"] = val
                elif "email fiscal" in key:
                    metadata["email"] = val
                elif "riesgo fiscal" in key:
                    metadata["riesgo_fiscal"] = val
                elif "score de cumplimiento" in key:
                    try:
                        metadata["score_cumplimiento"] = int(val)
                    except ValueError:
                        pass
                elif "embargos activos" in key:
                    try:
                        metadata["embargos_activos"] = int(val)
                    except ValueError:
                        pass
                elif "mesa" in key:
                    metadata["mesa_fiscalizacion"] = val
    return metadata
