from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.database.connection import Base

class Contribuyente(Base):
    __tablename__ = "contribuyentes"

    cuit = Column(String, primary_key=True)
    usuario = Column(String, unique=True, nullable=False)
    nombre = Column(String, nullable=False)
    actividad = Column(String)
    regimen = Column(String)
    forma_juridica = Column(String)
    agencia = Column(String)
    email = Column(String)
    domicilio = Column(String)
    riesgo_fiscal = Column(String)
    score_cumplimiento = Column(Integer)
    embargos_activos = Column(Integer)
    mesa_fiscalizacion = Column(String)

    # Relación uno-a-muchos con Deudas
    deudas = relationship("Deuda", back_populates="contribuyente", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Contribuyente(nombre='{self.nombre}', cuit='{self.cuit}')>"

class Deuda(Base):
    __tablename__ = "deudas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cuit = Column(String, ForeignKey("contribuyentes.cuit"), nullable=False)
    periodo = Column(String, nullable=False)  # Formato: 'YYYY-MM'
    concepto = Column(String, nullable=False)
    vencimiento = Column(String)              # Formato: 'YYYY-MM-DD'

    # Relaciones
    contribuyente = relationship("Contribuyente", back_populates="deudas")
    snapshots = relationship("DeudaSnapshot", back_populates="deuda", cascade="all, delete-orphan")

    # Restricción única: no se repite el mismo periodo y concepto para un mismo cuit
    __table_args__ = (
        UniqueConstraint("cuit", "periodo", "concepto", name="uq_cuit_periodo_concepto"),
    )

    def __repr__(self):
        return f"<Deuda(periodo='{self.periodo}', concepto='{self.concepto}', cuit='{self.cuit}')>"

class DeudaSnapshot(Base):
    __tablename__ = "deudas_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deuda_id = Column(Integer, ForeignKey("deudas.id"), nullable=False)
    corte = Column(String, nullable=False)   # Formato: 'YYYY-MM' (Fecha de la foto)
    capital = Column(Float, default=0.0)
    interes_resarcitorio = Column(Float, default=0.0)
    interes_punitorio = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    estado = Column(String)
    expediente = Column(String)

    # Relación
    deuda = relationship("Deuda", back_populates="snapshots")

    # Restricción única: a lo sumo un snapshot por deuda por fecha de corte
    __table_args__ = (
        UniqueConstraint("deuda_id", "corte", name="uq_deuda_corte"),
    )

    def __repr__(self):
        return f"<DeudaSnapshot(corte='{self.corte}', total={self.total}, estado='{self.estado}')>"
