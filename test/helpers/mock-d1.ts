import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

export class MockD1PreparedStatement {
  constructor(private db: DatabaseSync, private sql: string, private params: any[] = []) {}

  bind(...params: any[]): MockD1PreparedStatement {
    return new MockD1PreparedStatement(this.db, this.sql, params);
  }

  async first<T = any>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params) as any;
    if (!row) return null;
    if (colName) return row[colName];
    return row as T;
  }

  async all<T = any>(): Promise<{ results: T[]; success: boolean }> {
    const stmt = this.db.prepare(this.sql);
    const results = stmt.all(...this.params) as T[];
    return { results, success: true };
  }

  async run(): Promise<{ success: boolean; meta: any }> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...this.params);
    return { success: true, meta: info };
  }
}

export class MockD1Database {
  private db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.initSchema();
  }

  private initSchema() {
    const schemaPath = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(sql);
  }

  prepare(sql: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(this.db, sql);
  }

  async batch(statements: MockD1PreparedStatement[]): Promise<any[]> {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  getRaw(): DatabaseSync {
    return this.db;
  }
}

export function createTestDb(): D1Database {
  return new MockD1Database() as unknown as D1Database;
}
