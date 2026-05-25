import os
import sys
import json
import argparse
import time
import logging
from backend.database.connection import init_db
from backend.scraper.core import run_scraper

# Configuración de Logging en la estructura backend/data/logs
logs_dir = os.path.join('backend', 'data', 'logs')
os.makedirs(logs_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(logs_dir, 'scraper.log'), encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

def load_credentials(filepath='credentials.json'):
    """Carga las credenciales desde el archivo credentials.json."""
    if not os.path.exists(filepath):
        logger.error(f"No se encontró el archivo de credenciales en {filepath}")
        sys.exit(1)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            credentials = json.load(f)
            logger.info(f"Se cargaron {len(credentials)} contribuyentes exitosamente.")
            return credentials
    except Exception as e:
        logger.error(f"Error al leer credentials.json: {str(e)}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Scraper modular para extraer deudas del Portal ARCA.")
    parser.add_argument('--username', '-u', type=str, help="Usuario específico para testear.")
    parser.add_argument('--headless', action='store_true', default=True, help="Ejecutar en modo headless (por defecto True).")
    args = parser.parse_args()
    
    # Inicializar base de datos y crear tablas
    logger.info("Inicializando la base de datos SQL (SQLite/PostgreSQL)...")
    init_db()
    
    credentials = load_credentials()
    
    if args.username:
        # Filtrar por un usuario específico
        target_user = None
        for user in credentials:
            if user['username'] == args.username:
                target_user = user
                break
        if not target_user:
            logger.error(f"No se encontró el usuario {args.username} en credentials.json")
            sys.exit(1)
        run_scraper(target_user, headless=args.headless)
    else:
        # Ejecutar para todos los usuarios en bucle
        logger.info("Iniciando ejecución completa para todos los usuarios en credentials.json...")
        for user in credentials:
            try:
                run_scraper(user, headless=args.headless)
                logger.info(f"Finalizado procesamiento para {user['username']}")
                time.sleep(2)  # Delay para no saturar el servidor
            except Exception as e:
                logger.error(f"Error general procesando a {user['username']}: {str(e)}")

if __name__ == '__main__':
    main()
