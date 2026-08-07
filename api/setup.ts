import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthentication } from './_auth.js';
import { getDatabase } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  if (!requireAuthentication(req, res)) {
    return;
  }

  try {
    const sql = getDatabase();
    await sql`
      CREATE TABLE IF NOT EXISTS tours (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        destination TEXT NOT NULL,
        departure_date DATE,
        duration TEXT NOT NULL DEFAULT '',
        price_label TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('published', 'draft', 'upcoming')),
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        popular BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM tours`;
    if (Number(count) === 0) {
      await sql`
        INSERT INTO tours
          (title, destination, departure_date, duration, price_label, status, featured, popular)
        VALUES
          ('Karadeniz Batum Turu', 'Trabzon, Rize, Batum', '2026-08-18', '4 Gece 5 Gun', '18.900 TL', 'published', TRUE, TRUE),
          ('Kapadokya Balon Deneyimi', 'Nevsehir, Urgup, Goreme', '2026-08-22', '2 Gece 3 Gun', '12.750 TL', 'published', TRUE, FALSE),
          ('Buyuk Balkan Turu', 'Uskup, Ohrid, Belgrad', '2026-09-04', '6 Gece 7 Gun', '799 EUR', 'upcoming', TRUE, TRUE),
          ('Ege Koylari Rotasi', 'Izmir, Mugla', '2026-09-12', '5 Gece 6 Gun', '16.400 TL', 'draft', FALSE, FALSE),
          ('Dogu Ekspresi ve Kars', 'Ankara, Kars', '2026-12-18', '3 Gece 4 Gun', '21.500 TL', 'draft', FALSE, TRUE)
      `;
    }

    res.status(200).json({ created: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DATABASE_ERROR';
    res.status(503).json({ code: message, message: 'Veritabani hazirlanamadi.' });
  }
}
