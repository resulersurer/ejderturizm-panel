import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthentication } from './_auth.js';
import { getDatabase } from './_db.js';
import { ensureSlidesSchema } from './_schema.js';

type SlideInput = {
  title?: unknown;
  location?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  sortOrder?: unknown;
  active?: unknown;
};

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function order(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.max(0, Math.min(parsed, 999)) : fallback;
}

function idFrom(req: VercelRequest): number | null {
  const raw = Array.isArray(req.query['id']) ? req.query['id'][0] : req.query['id'];
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapSlide(row: Record<string, unknown>) {
  return {
    id: Number(row['id']),
    title: row['title'],
    location: row['location'],
    description: row['description'],
    imageUrl: row['image_url'],
    sortOrder: Number(row['sort_order']),
    active: Boolean(row['active']),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  try {
    await ensureSlidesSchema();
    const sql = getDatabase();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, title, location, description, image_url, sort_order, active
        FROM slides ORDER BY sort_order, created_at
      `;
      res.status(200).json(rows.map((row) => mapSlide(row)));
      return;
    }

    if (!requireAuthentication(req, res)) {
      return;
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as SlideInput;
      const title = text(body.title);
      if (!title) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Slider basligi zorunludur.' });
        return;
      }

      const rows = await sql`
        INSERT INTO slides (title, location, description, image_url, sort_order, active)
        VALUES (${title}, ${text(body.location)}, ${text(body.description)}, ${text(body.imageUrl)},
                ${order(body.sortOrder)}, ${body.active === undefined ? true : Boolean(body.active)})
        RETURNING id, title, location, description, image_url, sort_order, active
      `;
      res.status(201).json(mapSlide(rows[0]));
      return;
    }

    const id = idFrom(req);
    if (!id) {
      res.status(400).json({ code: 'INVALID_ID' });
      return;
    }

    if (req.method === 'PATCH') {
      const found = await sql`
        SELECT id, title, location, description, image_url, sort_order, active
        FROM slides WHERE id = ${id}
      `;
      if (!found.length) {
        res.status(404).json({ code: 'NOT_FOUND' });
        return;
      }

      const current = mapSlide(found[0]);
      const body = (req.body ?? {}) as SlideInput;
      const title = body.title === undefined ? String(current.title) : text(body.title);
      if (!title) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Slider basligi zorunludur.' });
        return;
      }

      const rows = await sql`
        UPDATE slides SET
          title = ${title},
          location = ${body.location === undefined ? String(current.location) : text(body.location)},
          description = ${body.description === undefined ? String(current.description) : text(body.description)},
          image_url = ${body.imageUrl === undefined ? String(current.imageUrl) : text(body.imageUrl)},
          sort_order = ${body.sortOrder === undefined ? Number(current.sortOrder) : order(body.sortOrder)},
          active = ${body.active === undefined ? Boolean(current.active) : Boolean(body.active)},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, title, location, description, image_url, sort_order, active
      `;
      res.status(200).json(mapSlide(rows[0]));
      return;
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM slides WHERE id = ${id}`;
      res.status(204).end();
      return;
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DATABASE_ERROR';
    res.status(503).json({ code: message, message: 'Slider verileri yuklenemedi.' });
  }
}
