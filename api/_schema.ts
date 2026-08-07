
import { getDatabase } from './_db.js';

export async function ensureSlidesSchema(): Promise<void> {
  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS slides (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM slides`;
  if (Number(count) === 0) {
    await sql`
      INSERT INTO slides (title, location, description, image_url, sort_order, active)
      VALUES
        ('Karadeniz Yaylalari', 'Trabzon - Rize', 'Yemyesil yaylalar, serin rotalar ve dogayla ic ice tur programlari.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=85', 1, TRUE),
        ('Kapadokya Balon Turu', 'Nevsehir', 'Gun dogumu manzaralari, vadiler ve unutulmaz Kapadokya deneyimi.', 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1920&q=85', 2, TRUE),
        ('Ege Kiyilari', 'Izmir - Mugla', 'Mavi koylar, butik duraklar ve yaz tatiline uygun keyifli guzergahlar.', 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1920&q=85', 3, TRUE)
    `;
  }
}

export async function ensureCategoriesSchema(): Promise<void> {
  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      program_count INTEGER NOT NULL DEFAULT 0 CHECK (program_count >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM categories`;
  if (Number(count) === 0) {
    await sql`
      INSERT INTO categories (name, description, program_count, sort_order, active)
      VALUES
        ('Kültür Turları', 'Tarih, mimari ve yerel lezzetlerle zengin rotalar.', 18, 1, TRUE),
        ('Yurt Dışı Turları', 'Yeni ülkeler ve şehirler keşfetmek isteyenlere özel programlar.', 12, 2, TRUE),
        ('Hafta Sonu Turları', 'Kısa sürede dinlenmek ve yenilenmek için yakın rotalar.', 9, 3, TRUE),
        ('Doğa ve Yayla', 'Yaylalar, yürüyüş rotaları ve doğayla iç içe deneyimler.', 7, 4, TRUE)
    `;
  }
}

export async function ensureReservationsSchema(): Promise<void> {
  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS reservations (
      id BIGSERIAL PRIMARY KEY,
      tour_id BIGINT NOT NULL REFERENCES tours(id) ON DELETE RESTRICT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      participants INTEGER NOT NULL DEFAULT 1 CHECK (participants BETWEEN 1 AND 30),
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
