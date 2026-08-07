
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthentication } from './_auth.js';
import { getDatabase } from './_db.js';
import { ensureCategoriesSchema } from './_schema.js';

type CategoryInput = {
  name?: unknown;
  description?: unknown;
  programCount?: unknown;
  sortOrder?: unknown;
  active?: unknown;
};

function text(value: unknown, maxLength: number, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
}

function integer(value: unknown, fallback: number, maximum = 999): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.max(0, Math.min(parsed, maximum)) : fallback;
}

function idFrom(req: VercelRequest): number | null {
  const raw = Array.isArray(req.query['id']) ? req.query['id'][0] : req.query['id'];
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapCategory(row: Record<string, unknown>) {
  return {
    id: Number(row['id']),
    name: row['name'],
    description: row['description'],
    programCount: Number(row['program_count']),
    sortOrder: Number(row['sort_order']),
    active: Boolean(row['active']),
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (!requireAuthentication(req, res)) {
    return;
  }

  try {
    await ensureCategoriesSchema();
    const sql = getDatabase();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, description, program_count, sort_order, active, created_at, updated_at
        FROM categories ORDER BY sort_order, created_at
      `;
      res.status(200).json(rows.map((row) => mapCategory(row)));
      return;
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as CategoryInput;
      const name = text(body.name, 120);
      if (!name) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Kategori adı zorunludur.' });
        return;
      }

      const rows = await sql`
        INSERT INTO categories (name, description, program_count, sort_order, active)
        VALUES (${name}, ${text(body.description, 300)}, ${integer(body.programCount, 0, 9999)},
                ${integer(body.sortOrder, 0)}, ${body.active === undefined ? true : Boolean(body.active)})
        RETURNING id, name, description, program_count, sort_order, active, created_at, updated_at
      `;
      res.status(201).json(mapCategory(rows[0]));
      return;
    }

    const id = idFrom(req);
    if (!id) {
      res.status(400).json({ code: 'INVALID_ID' });
      return;
    }

    if (req.method === 'PATCH') {
      const found = await sql`
        SELECT id, name, description, program_count, sort_order, active, created_at, updated_at
        FROM categories WHERE id = ${id}
      `;
      if (!found.length) {
        res.status(404).json({ code: 'NOT_FOUND' });
        return;
      }

      const current = mapCategory(found[0]);
      const body = (req.body ?? {}) as CategoryInput;
      const name = body.name === undefined ? String(current.name) : text(body.name, 120);
      if (!name) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Kategori adı zorunludur.' });
        return;
      }

      const rows = await sql`
        UPDATE categories SET
          name = ${name},
          description = ${body.description === undefined ? String(current.description) : text(body.description, 300)},
          program_count = ${body.programCount === undefined ? Number(current.programCount) : integer(body.programCount, 0, 9999)},
          sort_order = ${body.sortOrder === undefined ? Number(current.sortOrder) : integer(body.sortOrder, 0)},
          active = ${body.active === undefined ? Boolean(current.active) : Boolean(body.active)},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, name, description, program_count, sort_order, active, created_at, updated_at
      `;
      res.status(200).json(mapCategory(rows[0]));
      return;
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM categories WHERE id = ${id}`;
      res.status(204).end();
      return;
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DATABASE_ERROR';
    const conflict = message.includes('categories_name_key');
    res.status(conflict ? 409 : 503).json({
      code: conflict ? 'CATEGORY_EXISTS' : message,
      message: conflict ? 'Bu kategori adı zaten kullanılıyor.' : 'Kategori verileri yüklenemedi.',
    });
  }
}
