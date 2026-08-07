import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthentication } from './_auth.js';
import { getDatabase, isMissingTable } from './_db.js';

type TourStatus = 'published' | 'draft' | 'upcoming';

type TourInput = {
  title?: unknown;
  destination?: unknown;
  departureDate?: unknown;
  duration?: unknown;
  priceLabel?: unknown;
  status?: unknown;
  featured?: unknown;
  popular?: unknown;
};

const statuses = new Set<TourStatus>(['published', 'draft', 'upcoming']);

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function date(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function status(value: unknown): TourStatus {
  return typeof value === 'string' && statuses.has(value as TourStatus)
    ? (value as TourStatus)
    : 'draft';
}

function idFrom(req: VercelRequest): number | null {
  const raw = Array.isArray(req.query['id']) ? req.query['id'][0] : req.query['id'];
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapTour(row: Record<string, unknown>) {
  return {
    id: Number(row['id']),
    title: row['title'],
    destination: row['destination'],
    departureDate: row['departure_date'],
    duration: row['duration'],
    priceLabel: row['price_label'],
    status: row['status'],
    featured: row['featured'],
    popular: row['popular'],
  };
}

function databaseError(res: VercelResponse, error: unknown): void {
  if (isMissingTable(error)) {
    res.status(503).json({
      code: 'SETUP_REQUIRED',
      message: 'Tur tablosu henuz hazirlanmadi.',
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'DATABASE_ERROR';
  res.status(503).json({ code: message, message: 'Veritabani baglantisi kurulamadi.' });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const sql = getDatabase();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, title, destination, departure_date, duration, price_label,
               status, featured, popular
        FROM tours
        ORDER BY departure_date NULLS LAST, created_at DESC
      `;
      res.status(200).json(rows.map((row) => mapTour(row)));
      return;
    }

    if (!requireAuthentication(req, res)) {
      return;
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as TourInput;
      const title = text(body.title);
      const destination = text(body.destination);
      if (!title || !destination) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Tur adi ve destinasyon zorunludur.' });
        return;
      }

      const rows = await sql`
        INSERT INTO tours
          (title, destination, departure_date, duration, price_label, status, featured, popular)
        VALUES
          (${title}, ${destination}, ${date(body.departureDate)}, ${text(body.duration)},
           ${text(body.priceLabel)}, ${status(body.status)}, ${Boolean(body.featured)}, ${Boolean(body.popular)})
        RETURNING id, title, destination, departure_date, duration, price_label,
                  status, featured, popular
      `;
      res.status(201).json(mapTour(rows[0]));
      return;
    }

    const id = idFrom(req);
    if (!id) {
      res.status(400).json({ code: 'INVALID_ID', message: 'Gecerli bir tur kimligi gerekli.' });
      return;
    }

    if (req.method === 'PATCH') {
      const existingRows = await sql`
        SELECT id, title, destination, departure_date, duration, price_label,
               status, featured, popular
        FROM tours WHERE id = ${id}
      `;
      if (!existingRows.length) {
        res.status(404).json({ code: 'NOT_FOUND' });
        return;
      }

      const existing = mapTour(existingRows[0]);
      const body = (req.body ?? {}) as TourInput;
      const title = body.title === undefined ? String(existing.title) : text(body.title);
      const destination =
        body.destination === undefined ? String(existing.destination) : text(body.destination);
      if (!title || !destination) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Tur adi ve destinasyon zorunludur.' });
        return;
      }

      const rows = await sql`
        UPDATE tours SET
          title = ${title},
          destination = ${destination},
          departure_date = ${body.departureDate === undefined ? existing.departureDate : date(body.departureDate)},
          duration = ${body.duration === undefined ? String(existing.duration) : text(body.duration)},
          price_label = ${body.priceLabel === undefined ? String(existing.priceLabel) : text(body.priceLabel)},
          status = ${body.status === undefined ? String(existing.status) : status(body.status)},
          featured = ${body.featured === undefined ? Boolean(existing.featured) : Boolean(body.featured)},
          popular = ${body.popular === undefined ? Boolean(existing.popular) : Boolean(body.popular)},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, title, destination, departure_date, duration, price_label,
                  status, featured, popular
      `;
      res.status(200).json(mapTour(rows[0]));
      return;
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM tours WHERE id = ${id}`;
      res.status(204).end();
      return;
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    databaseError(res, error);
  }
}
