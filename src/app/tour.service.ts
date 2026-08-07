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
  createdAt: string;
  updatedAt: string;
};

export type TourInput = Omit<Tour, 'id' | 'createdAt' | 'updatedAt'>;

export type Slide = {
  id: number;
  title: string;
  location: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SlideInput = Omit<Slide, 'id' | 'createdAt' | 'updatedAt'>;

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';

export type Reservation = {
  id: number;
  tourId: number;
  tourTitle: string;
  fullName: string;
  email: string;
  phone: string;
  participants: number;
  notes: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
};

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

  listSlides() {
    return this.http.get<Slide[]>('/api/slides');
  }

  createSlide(slide: SlideInput) {
    return this.http.post<Slide>('/api/slides', slide);
  }

  updateSlide(id: number, slide: Partial<SlideInput>) {
    return this.http.patch<Slide>(`/api/slides?id=${id}`, slide);
  }

  removeSlide(id: number) {
    return this.http.delete<void>(`/api/slides?id=${id}`);
  }

  listReservations() {
    return this.http.get<Reservation[]>('/api/reservations');
  }

  updateReservationStatus(id: number, status: ReservationStatus) {
    return this.http.patch<Reservation>(`/api/reservations?id=${id}`, { status });
  }
}
