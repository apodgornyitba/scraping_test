#!/usr/bin/env python3
import sys
from backend.database.connection import SessionLocal
from backend.database.models import Contribuyente, Deuda, DeudaSnapshot
from sqlalchemy import func

def verify_db():
    print("==================================================")
    print("🔍 VERIFICACIÓN DE BASE DE DATOS TRIBUTARIA (ARCA)")
    print("==================================================")
    
    db = SessionLocal()
    try:
        # 1. Contar registros
        num_contribuyentes = db.query(Contribuyente).count()
        num_deudas = db.query(Deuda).count()
        num_snapshots = db.query(DeudaSnapshot).count()
        
        print(f"📊 Estadísticas Generales:")
        print(f"  - Contribuyentes: {num_contribuyentes}")
        print(f"  - Deudas únicas:  {num_deudas}")
        print(f"  - Historial (Snapshots): {num_snapshots}")
        print("-" * 50)
        
        if num_contribuyentes == 0:
            print("⚠️  La base de datos está vacía. Ejecute el scraper para poblarla.")
            return

        # 2. Listar contribuyentes
        print("👤 Contribuyentes Registrados:")
        contribuyentes = db.query(Contribuyente).all()
        for c in contribuyentes:
            print(f"  * CUIT: {c.cuit} | Usuario: {c.usuario} | Nombre: {c.nombre}")
            print(f"    Régimen: {c.regimen} | Actividad: {c.actividad}")
            print(f"    Agencia: {c.agencia} | Email: {c.email} | Domicilio: {c.domicilio}")
            print(f"    Riesgo: {c.riesgo_fiscal} | Score: {c.score_cumplimiento} | Embargos: {c.embargos_activos} | Mesa: {c.mesa_fiscalizacion}")
            print("-" * 40)
            
        # 3. Mostrar resumen de deudas y snapshots
        print("💰 Resumen Financiero por Contribuyente:")
        ultimo_corte = db.query(func.max(DeudaSnapshot.corte)).scalar()
        print(f"  (Cálculos basados en el último corte histórico disponible: {ultimo_corte})")
        
        results = db.query(
            Contribuyente.nombre,
            Contribuyente.cuit,
            func.sum(DeudaSnapshot.capital).label("capital"),
            func.sum(DeudaSnapshot.interes_resarcitorio).label("resarcitorio"),
            func.sum(DeudaSnapshot.interes_punitorio).label("punitorio"),
            func.sum(DeudaSnapshot.total).label("total"),
            func.count(Deuda.id).label("cant_obligaciones")
        ).join(Deuda, Contribuyente.cuit == Deuda.cuit)\
         .join(DeudaSnapshot, Deuda.id == DeudaSnapshot.deuda_id)\
         .filter(DeudaSnapshot.corte == ultimo_corte)\
         .group_by(Contribuyente.cuit).all()
         
        for r in results:
            print(f"  * {r.nombre} ({r.cuit}):")
            print(f"    - Obligaciones con saldo: {r.cant_obligaciones}")
            print(f"    - Capital:               ${r.capital:,.2f}")
            print(f"    - Int. Resarcitorio:     ${r.resarcitorio:,.2f}")
            print(f"    - Int. Punitorio:        ${r.punitorio:,.2f}")
            print(f"    - Deuda Total:           ${r.total:,.2f}")
            print("-" * 40)
            
        # 4. Mostrar algunas deudas de muestra
        print("📝 Muestra de 5 Deudas Históricas (Snapshots):")
        snapshots = db.query(DeudaSnapshot).order_by(DeudaSnapshot.id.desc()).limit(5).all()
        for s in snapshots:
            d = s.deuda
            c = d.contribuyente
            print(f"  * [{s.corte}] {c.nombre} - Periodo: {d.periodo} | Concepto: {d.concepto}")
            print(f"    Total: ${s.total:,.2f} | Estado: {s.estado} | Expediente: {s.expediente}")
            
    except Exception as e:
        print(f"❌ Error al consultar la base de datos: {str(e)}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    verify_db()
