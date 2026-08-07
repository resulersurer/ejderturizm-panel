import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export type TourStatus = 'published' | 'draft' | 'upcoming';

export type Tour = {
  id: number;
  title: string;
  destination: string;
  departureDate: string | null;
  duration: string;
  priceLabel: string;
  status: TourStatus;
  featured: boolean;
  popular: boolean;
};

export type TourInput = Omit<Tour, 'id'>;

type SessionResponse = {
  authenticated: boolean;
  configured: boolean;
};

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly http = inject(HttpClient);

  session() {
    return this.http.get<SessionResponse>('/api/auth');
  }

  login(password: string) {
    return this.http.post<SessionResponse>('/api/auth', { password });
  }

  logout() {
    return this.http.delete<void>('/api/auth');
  }

  setup() {
    return this.http.post<{ created: boolean }>('/api/setup', {});
  }

  list() {
    return this.http.get<Tour[]>('/api/tours');
  }

  create(tour: TourInput) {
    return this.http.post<Tour>('/api/tours', tour);
  }

  update(id: number, tour: Partial<TourInput>) {
    return this.http.patch<Tour>(`/api/tours?id=${id}`, tour);
  }

  remove(id: number) {
    return this.http.delete<void>(`/api/tours?id=${id}`);
  }
}
