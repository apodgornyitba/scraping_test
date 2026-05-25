import Database from 'better-sqlite3';
import path from 'path';

// Localizar el archivo arca.db en la estructura jerárquica de backend
const dbPath = path.resolve(process.cwd(), '..', 'backend', 'data', 'database', 'arca.db');

const db = new Database(dbPath, {
  fileMustExist: false, // Crear si no existe (evita crashes iniciales si no ha terminado)
});

// Configurar pragmas óptimos para SQLite en lectura
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

export default db;
