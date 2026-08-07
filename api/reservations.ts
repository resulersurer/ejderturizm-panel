
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthentication } from './_auth.js';
import { getDatabase } from './_db.js';
import { ensureReservationsSchema } from './_schema.js';

type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';
const statuses = new Set<ReservationStatus>(['pending', 'confirmed', 'cancelled']);

function idFrom(req: VercelRequest): number | null {
  const raw = Array.isArray(req.query['id']) ? req.query['id'][0] : req.query['id'];
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function mapReservation(row: Record<string, unknown>) {
  return {
    id: Number(row['id']),
    tourId: Number(row['tour_id']),
    tourTitle: row['tour_title'],
    fullName: row['full_name'],
    email: row['email'],
    phone: row['phone'],
    participants: Number(row['participants']),
    notes: row['notes'],
    status: row['status'],
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
    await ensureReservationsSchema();
    const sql = getDatabase();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT r.id, r.tour_id, t.title AS tour_title, r.full_name, r.email, r.phone,
               r.participants, r.notes, r.status, r.created_at, r.updated_at
        FROM reservations r
        JOIN tours t ON t.id = r.tour_id
        ORDER BY r.created_at DESC
      `;
      res.status(200).json(rows.map((row) => mapReservation(row)));
      return;
    }

    if (req.method === 'PATCH') {
      const id = idFrom(req);
      const requestedStatus = req.body?.status;
      if (!id || typeof requestedStatus !== 'string' || !statuses.has(requestedStatus as ReservationStatus)) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Rezervasyon durumu geçersiz.' });
        return;
      }

      const rows = await sql`
        UPDATE reservations SET status = ${requestedStatus}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id
      `;
      if (!rows.length) {
        res.status(404).json({ code: 'NOT_FOUND' });
        return;
      }

      const result = await sql`
        SELECT r.id, r.tour_id, t.title AS tour_title, r.full_name, r.email, r.phone,
               r.participants, r.notes, r.status, r.created_at, r.updated_at
        FROM reservations r
        JOIN tours t ON t.id = r.tour_id
        WHERE r.id = ${id}
      `;
      res.status(200).json(mapReservation(result[0]));
      return;
    }

    res.setHeader('Allow', 'GET, PATCH');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DATABASE_ERROR';
    res.status(503).json({ code: message, message: 'Rezervasyonlar yüklenemedi.' });
  }
}
