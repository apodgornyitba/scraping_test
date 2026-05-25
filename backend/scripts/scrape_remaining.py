#!/usr/bin/env python3
"""
Script utilitario para reanudar el scraping únicamente de los contribuyentes
pendientes (u463607, u352256, u779928, u643569, u151694).
"""
import sys
import time
import logging
from backend.database.connection import init_db
from backend.scraper.core import run_scraper
from backend.main import load_credentials

# Configuración de Logging en la estructura backend/data/logs
import os
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

def main():
    logger.info("Inicializando la base de datos SQL (SQLite/PostgreSQL)...")
    init_db()
    
    credentials = load_credentials()
    remaining_usernames = {"u463607", "u352256", "u779928", "u643569", "u151694"}
    
    logger.info(f"Filtrando credenciales para procesar únicamente los usuarios restantes: {remaining_usernames}")
    to_process = [u for u in credentials if u["username"] in remaining_usernames]
    
    logger.info(f"Se procesarán {len(to_process)} usuarios pendientes.")
    
    for user in to_process:
        try:
            logger.info(f"Iniciando scraping reanudado para: {user['username']}")
            run_scraper(user, headless=True)
            logger.info(f"Finalizado procesamiento reanudado para {user['username']}")
            time.sleep(2)
        except Exception as e:
            logger.error(f"Error general procesando a {user['username']} en reanudación: {str(e)}")

if __name__ == '__main__':
    main()
