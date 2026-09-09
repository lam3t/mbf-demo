import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';

// Ensure uploads and database directory exist
const dbDir = path.dirname(CONFIG.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}

export interface StatementResult {
  lastInsertRowid: number | bigint;
  changes: number | bigint;
}

export interface PreparedStatement {
  run(...params: any[]): StatementResult;
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface IDatabase {
  exec(sql: string): void;
  prepare(sql: string): PreparedStatement;
  pragma(sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

class SQLiteDatabase implements IDatabase {
  private rawDb: any;

  constructor(filePath: string) {
    try {
      // Use built-in node:sqlite (Node 22+)
      const { DatabaseSync } = require('node:sqlite');
      this.rawDb = new DatabaseSync(filePath);
      this.rawDb.exec('PRAGMA foreign_keys = ON;');
      this.rawDb.exec('PRAGMA journal_mode = WAL;');
    } catch (e) {
      try {
        const BetterSqlite3 = require('better-sqlite3');
        this.rawDb = new BetterSqlite3(filePath);
        this.rawDb.pragma('journal_mode = WAL');
        this.rawDb.pragma('foreign_keys = ON');
      } catch (err) {
        throw new Error('Could not load SQLite engine: ' + err);
      }
    }
  }

  exec(sql: string): void {
    this.rawDb.exec(sql);
  }

  pragma(sql: string): void {
    if (typeof this.rawDb.pragma === 'function') {
      this.rawDb.pragma(sql);
    } else {
      this.rawDb.exec(`PRAGMA ${sql};`);
    }
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.rawDb.prepare(sql);
    return {
      run: (...params: any[]) => {
        return stmt.run(...params);
      },
      get: (...params: any[]) => {
        return stmt.get(...params);
      },
      all: (...params: any[]) => {
        return stmt.all(...params);
      }
    };
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    if (typeof this.rawDb.transaction === 'function') {
      return this.rawDb.transaction(fn);
    }
    return ((...args: any[]) => {
      this.rawDb.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        this.rawDb.exec('COMMIT');
        return result;
      } catch (err) {
        this.rawDb.exec('ROLLBACK');
        throw err;
      }
    }) as T;
  }
}

export const db: IDatabase = new SQLiteDatabase(CONFIG.DB_PATH);

export function initDatabase(): void {
  const possiblePaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(__dirname, '../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'backend/src/db/schema.sql')
  ];
  const schemaPath = possiblePaths.find(p => fs.existsSync(p));
  if (schemaPath) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    console.log('✅ SQLite Schema initialized successfully from:', schemaPath);
  } else {
    console.warn('⚠️ Schema file not found in possible paths:', possiblePaths);
  }

  // Auto seed initial demo dataset if database is freshly created
  try {
    const userCheck = db.prepare("SELECT count(*) as count FROM users").get() as { count: number } | undefined;
    if (!userCheck || userCheck.count === 0) {
      console.log('📦 Database is empty, auto-running seed data...');
      const { runSeed } = require('./seed');
      runSeed(true);
    }
  } catch (err) {
    console.warn('⚠️ Auto-seed check skipped or failed:', err);
  }
}

export default db;
