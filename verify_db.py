#!/usr/bin/env python3
"""
Wrapper de diagnóstico para ejecutar la verificación modular de la base de datos.
"""
from backend.scripts.verify_db import verify_db

if __name__ == '__main__':
    verify_db()
