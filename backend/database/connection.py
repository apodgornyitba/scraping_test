import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Leer la URL de la base de datos de una variable de entorno, por defecto usar SQLite en backend/data/database/arca.db
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///backend/data/database/arca.db")

# Crear el motor de la base de datos
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Crear una fábrica de sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Clase base declarativa para los modelos
Base = declarative_base()

def init_db():
    """Inicializa la base de datos, creando todas las tablas definidas."""
    # Asegurar que el directorio del archivo SQLite exista
    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

    # Importar los modelos del submódulo para asegurar que se registren en la metadata
    import backend.database.models
    Base.metadata.create_all(bind=engine)
