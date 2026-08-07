import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Reservation,
  ReservationStatus,
  Slide,
  SlideInput,
  Tour,
  TourInput,
  TourService,
  TourStatus,
} from './tour.service';

type NavItem = {
  label: string;
  icon: string;
  badge?: string;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  updatedAt: string;
  tone: 'green' | 'coral' | 'gold' | 'neutral';
};

type DraftTour = {
  title: string;
  destination: string;
  departureDate: string;
  duration: string;
  priceLabel: string;
  featured: boolean;
  popular: boolean;
};

const emptyDraft = (): DraftTour => ({
  title: '',
  destination: '',
  departureDate: '',
  duration: '',
  priceLabel: '',
  featured: false,
  popular: false,
});

type DraftSlide = {
  title: string;
  location: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  active: boolean;
};

const emptySlideDraft = (): DraftSlide => ({
  title: '',
  location: '',
  description: '',
  imageUrl: '',
  sortOrder: 1,
  active: true,
});

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly tourService = inject(TourService);

  protected readonly isSidebarOpen = signal(false);
  protected readonly isTourDialogOpen = signal(false);
  protected readonly editingTourId = signal<number | null>(null);
  protected readonly isSlideDialogOpen = signal(false);
  protected readonly editingSlideId = signal<number | null>(null);
  protected readonly activeSection = signal('Genel Bakis');
  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<TourStatus | 'all'>('all');
  protected readonly tourWorkspaceView = signal<'tours' | 'reservations'>('tours');
  protected readonly tours = signal<Tour[]>([]);
  protected readonly slides = signal<Slide[]>([]);
  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly isAuthenticated = signal(false);
  protected readonly isAuthChecking = signal(true);
  protected readonly isBusy = signal(false);
  protected readonly setupRequired = signal(false);
  protected readonly notice = signal('');
  protected readonly errorMessage = signal('');
  protected readonly isDataOnline = signal(false);
  protected readonly lastSyncAt = signal<Date | null>(null);

  protected password = '';
  protected draftTour = emptyDraft();
  protected draftSlide = emptySlideDraft();

  protected readonly primaryNavigation: NavItem[] = [
    { label: 'Genel Bakis', icon: 'dashboard' },
    { label: 'Turlar', icon: 'travel_explore' },
    { label: 'Slider', icon: 'image' },
    { label: 'Kategoriler', icon: 'category' },
    { label: 'Destinasyonlar', icon: 'location_on' },
  ];

  protected readonly contentNavigation: NavItem[] = [
    { label: 'Kampanyalar', icon: 'campaign', badge: '3' },
    { label: 'Blog Yazilari', icon: 'article' },
    { label: 'Misafir Yorumlari', icon: 'star', badge: '5' },
  ];

  protected readonly filteredTours = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('tr-TR');
    const selectedStatus = this.statusFilter();

    return this.tours().filter((tour) => {
      const matchesTerm =
        !term ||
        tour.title.toLocaleLowerCase('tr-TR').includes(term) ||
        tour.destination.toLocaleLowerCase('tr-TR').includes(term);
      const matchesStatus = selectedStatus === 'all' || tour.status === selectedStatus;
      return matchesTerm && matchesStatus;
    });
  });

  protected readonly publishedTourCount = computed(
    () => this.tours().filter((tour) => tour.status === 'published').length,
  );

  protected readonly activeSlideCount = computed(
    () => this.slides().filter((slide) => slide.active).length,
  );

  protected readonly pendingContentCount = computed(
    () =>
      this.tours().filter((tour) => tour.status === 'draft').length +
      this.slides().filter((slide) => !slide.active).length,
  );

  protected readonly pendingReservationCount = computed(
    () => this.reservations().filter((reservation) => reservation.status === 'pending').length,
  );

  protected readonly confirmedReservationCount = computed(
    () => this.reservations().filter((reservation) => reservation.status === 'confirmed').length,
  );

  protected readonly publishedPercentage = computed(() => {
    const total = this.tours().length;
    return total ? Math.round((this.publishedTourCount() / total) * 100) : 0;
  });

  protected readonly nextTour = computed(() =>
    this.tours().find(
      (tour) =>
        Boolean(tour.departureDate) &&
        new Date(String(tour.departureDate)).getTime() >= new Date().setHours(0, 0, 0, 0),
    ),
  );

  protected readonly recentActivities = computed<ActivityItem[]>(() => {
    const tourActivities: ActivityItem[] = this.tours().map((tour) => ({
      id: `tour-${tour.id}`,
      title: tour.title,
      detail:
        tour.status === 'published'
          ? 'Tur web sitesinde yayında'
          : tour.status === 'upcoming'
            ? 'Yaklaşan tur olarak planlandı'
            : 'Tur taslak olarak bekliyor',
      updatedAt: tour.updatedAt,
      tone: tour.status === 'published' ? 'green' : tour.status === 'upcoming' ? 'gold' : 'neutral',
    }));
    const slideActivities: ActivityItem[] = this.slides().map((slide) => ({
      id: `slide-${slide.id}`,
      title: slide.title,
      detail: slide.active ? 'Slider web sitesinde yayında' : 'Slider pasife alındı',
      updatedAt: slide.updatedAt,
      tone: slide.active ? 'coral' : 'neutral',
    }));

    return [...tourActivities, ...slideActivities]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  });

  protected readonly overviewDate = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(new Date());

  async ngOnInit(): Promise<void> {
    await this.checkSession();
  }

  protected selectSection(label: string): void {
    this.activeSection.set(label);
    this.isSidebarOpen.set(false);
  }

  protected toggleSidebar(): void {
    this.isSidebarOpen.update((isOpen) => !isOpen);
  }

  protected async login(): Promise<void> {
    if (!this.password || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.errorMessage.set('');
    try {
      await firstValueFrom(this.tourService.login(this.password));
      this.password = '';
      this.isAuthenticated.set(true);
      await this.loadContent();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Yonetici parolasi dogrulanamadi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected async logout(): Promise<void> {
    try {
      await firstValueFrom(this.tourService.logout());
    } finally {
      this.isAuthenticated.set(false);
      this.tours.set([]);
      this.slides.set([]);
      this.reservations.set([]);
      this.isDataOnline.set(false);
      this.lastSyncAt.set(null);
    }
  }

  protected async prepareDatabase(): Promise<void> {
    this.isBusy.set(true);
    this.errorMessage.set('');
    try {
      await firstValueFrom(this.tourService.setup());
      this.setupRequired.set(false);
      this.notice.set('Veritabani hazirlandi. Web sitesi artik paneldeki turlari kullanacak.');
      await this.loadContent();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Veritabani hazirlanamadi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected openTourDialog(): void {
    this.editingTourId.set(null);
    this.draftTour = emptyDraft();
    this.isTourDialogOpen.set(true);
  }

  protected openEditTour(tour: Tour): void {
    this.editingTourId.set(tour.id);
    this.draftTour = {
      title: tour.title,
      destination: tour.destination,
      departureDate: tour.departureDate?.slice(0, 10) ?? '',
      duration: tour.duration,
      priceLabel: tour.priceLabel,
      featured: tour.featured,
      popular: tour.popular,
    };
    this.isTourDialogOpen.set(true);
  }

  protected closeTourDialog(): void {
    this.isTourDialogOpen.set(false);
    this.editingTourId.set(null);
    this.draftTour = emptyDraft();
  }

  protected async saveTour(): Promise<void> {
    if (!this.draftTour.title.trim() || !this.draftTour.destination.trim() || this.isBusy()) {
      return;
    }

    const payload: TourInput = {
      title: this.draftTour.title.trim(),
      destination: this.draftTour.destination.trim(),
      departureDate: this.draftTour.departureDate || null,
      duration: this.draftTour.duration.trim(),
      priceLabel: this.draftTour.priceLabel.trim(),
      status: this.editingTourId()
        ? (this.tours().find((tour) => tour.id === this.editingTourId())?.status ?? 'draft')
        : 'draft',
      featured: this.draftTour.featured,
      popular: this.draftTour.popular,
    };

    this.isBusy.set(true);
    this.errorMessage.set('');
    try {
      const id = this.editingTourId();
      const saved = id
        ? await firstValueFrom(this.tourService.update(id, payload))
        : await firstValueFrom(this.tourService.create(payload));
      this.tours.update((tours) =>
        id ? tours.map((tour) => (tour.id === id ? saved : tour)) : [saved, ...tours],
      );
      this.notice.set(id ? 'Tur guncellendi.' : 'Yeni tur taslak olarak olusturuldu.');
      this.closeTourDialog();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Tur kaydedilemedi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected async toggleTourStatus(tour: Tour): Promise<void> {
    const newStatus: TourStatus = tour.status === 'published' ? 'draft' : 'published';
    this.isBusy.set(true);
    try {
      const updated = await firstValueFrom(this.tourService.update(tour.id, { status: newStatus }));
      this.tours.update((tours) => tours.map((item) => (item.id === tour.id ? updated : item)));
      this.notice.set(newStatus === 'published' ? 'Tur web sitesinde yayinlandi.' : 'Tur taslaga alindi.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Yayin durumu degistirilemedi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected async deleteTour(tourId: number): Promise<void> {
    if (!window.confirm('Bu turu kalici olarak silmek istediginize emin misiniz?')) {
      return;
    }

    this.isBusy.set(true);
    try {
      await firstValueFrom(this.tourService.remove(tourId));
      this.tours.update((tours) => tours.filter((tour) => tour.id !== tourId));
      this.notice.set('Tur silindi.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Tur silinemedi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected openSlideDialog(): void {
    this.editingSlideId.set(null);
    this.draftSlide = {
      ...emptySlideDraft(),
      sortOrder: this.slides().length + 1,
    };
    this.isSlideDialogOpen.set(true);
  }

  protected openEditSlide(slide: Slide): void {
    this.editingSlideId.set(slide.id);
    this.draftSlide = {
      title: slide.title,
      location: slide.location,
      description: slide.description,
      imageUrl: slide.imageUrl,
      sortOrder: slide.sortOrder,
      active: slide.active,
    };
    this.isSlideDialogOpen.set(true);
  }

  protected closeSlideDialog(): void {
    this.isSlideDialogOpen.set(false);
    this.editingSlideId.set(null);
    this.draftSlide = emptySlideDraft();
  }

  protected async saveSlide(): Promise<void> {
    if (!this.draftSlide.title.trim() || this.isBusy()) {
      return;
    }

    const payload: SlideInput = {
      title: this.draftSlide.title.trim(),
      location: this.draftSlide.location.trim(),
      description: this.draftSlide.description.trim(),
      imageUrl: this.draftSlide.imageUrl.trim(),
      sortOrder: Number(this.draftSlide.sortOrder) || 0,
      active: this.draftSlide.active,
    };

    this.isBusy.set(true);
    this.errorMessage.set('');
    try {
      const id = this.editingSlideId();
      const saved = id
        ? await firstValueFrom(this.tourService.updateSlide(id, payload))
        : await firstValueFrom(this.tourService.createSlide(payload));
      this.slides.update((slides) =>
        (id ? slides.map((slide) => (slide.id === id ? saved : slide)) : [...slides, saved]).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
      );
      this.notice.set(id ? 'Slider guncellendi.' : 'Yeni slider eklendi.');
      this.closeSlideDialog();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Slider kaydedilemedi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected async toggleSlideActive(slide: Slide): Promise<void> {
    this.isBusy.set(true);
    try {
      const updated = await firstValueFrom(
        this.tourService.updateSlide(slide.id, { active: !slide.active }),
      );
      this.slides.update((slides) =>
        slides.map((item) => (item.id === slide.id ? updated : item)),
      );
      this.notice.set(updated.active ? 'Slider web sitesinde yayinda.' : 'Slider pasife alindi.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Slider durumu degistirilemedi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected async deleteSlide(slideId: number): Promise<void> {
    if (!window.confirm('Bu slideri kalici olarak silmek istediginize emin misiniz?')) {
      return;
    }

    this.isBusy.set(true);
    try {
      await firstValueFrom(this.tourService.removeSlide(slideId));
      this.slides.update((slides) => slides.filter((slide) => slide.id !== slideId));
      this.notice.set('Slider silindi.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Slider silinemedi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected slideBackground(imageUrl: string): string | null {
    return imageUrl ? `url("${imageUrl.replaceAll('"', '%22')}")` : null;
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as TourStatus | 'all');
  }

  protected reservationCountForTour(tourId: number): number {
    return this.reservations().filter((reservation) => reservation.tourId === tourId).length;
  }

  protected async updateReservationStatus(
    reservation: Reservation,
    event: Event,
  ): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const status = select.value as ReservationStatus;
    if (status === reservation.status || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.errorMessage.set('');
    try {
      const updated = await firstValueFrom(
        this.tourService.updateReservationStatus(reservation.id, status),
      );
      this.reservations.update((reservations) =>
        reservations.map((item) => (item.id === reservation.id ? updated : item)),
      );
      this.notice.set(`Rezervasyon ${this.reservationStatusLabel(status).toLocaleLowerCase('tr-TR')} olarak güncellendi.`);
    } catch (error) {
      select.value = reservation.status;
      this.errorMessage.set(this.errorText(error, 'Rezervasyon durumu güncellenemedi.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  protected tourInitials(title: string): string {
    return title
      .split(' ')
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('');
  }

  protected statusLabel(status: TourStatus): string {
    return { published: 'Yayında', draft: 'Taslak', upcoming: 'Yakında' }[status];
  }

  protected reservationStatusLabel(status: ReservationStatus): string {
    return { pending: 'Bekliyor', confirmed: 'Onaylandı', cancelled: 'İptal edildi' }[status];
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Tarih belirlenmedi';
    }
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(value));
  }

  protected activityTime(value: string): string {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) {
      return 'Zaman bilgisi yok';
    }

    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
    if (minutes < 1) {
      return 'Az önce';
    }
    if (minutes < 60) {
      return `${minutes} dakika önce`;
    }
    if (minutes < 1_440) {
      return `${Math.floor(minutes / 60)} saat önce`;
    }

    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected lastSyncLabel(): string {
    const value = this.lastSyncAt();
    return value
      ? `Son senkronizasyon ${new Intl.DateTimeFormat('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(value)}`
      : 'Henüz senkronizasyon yapılmadı';
  }

  private async checkSession(): Promise<void> {
    try {
      const session = await firstValueFrom(this.tourService.session());
      this.isAuthenticated.set(session.authenticated);
      if (!session.configured) {
        this.errorMessage.set('Vercel panel projesine PANEL_ADMIN_KEY eklenmesi gerekiyor.');
      }
      if (session.authenticated) {
        await this.loadContent();
      }
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Panel sunucusuna ulasilamadi.'));
    } finally {
      this.isAuthChecking.set(false);
    }
  }

  private async loadTours(): Promise<boolean> {
    try {
      this.tours.set(await firstValueFrom(this.tourService.list()));
      this.setupRequired.set(false);
      return true;
    } catch (error) {
      const response = error as HttpErrorResponse;
      if (response.error?.code === 'SETUP_REQUIRED') {
        this.setupRequired.set(true);
        return false;
      }
      this.errorMessage.set(this.errorText(error, 'Turlar yuklenemedi.'));
      return false;
    }
  }

  private async loadSlides(): Promise<boolean> {
    try {
      this.slides.set(await firstValueFrom(this.tourService.listSlides()));
      return true;
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Sliderlar yuklenemedi.'));
      return false;
    }
  }

  private async loadReservations(): Promise<boolean> {
    try {
      this.reservations.set(await firstValueFrom(this.tourService.listReservations()));
      return true;
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Rezervasyonlar yüklenemedi.'));
      return false;
    }
  }

  private async loadContent(): Promise<void> {
    const [toursLoaded, slidesLoaded, reservationsLoaded] = await Promise.all([
      this.loadTours(),
      this.loadSlides(),
      this.loadReservations(),
    ]);
    const isOnline = toursLoaded && slidesLoaded && reservationsLoaded;
    this.isDataOnline.set(isOnline);
    if (isOnline) {
      this.lastSyncAt.set(new Date());
    }
  }

  private errorText(error: unknown, fallback: string): string {
    const response = error as HttpErrorResponse;
    return typeof response.error?.message === 'string' ? response.error.message : fallback;
  }
}
