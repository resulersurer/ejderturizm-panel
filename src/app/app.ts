import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Slide, SlideInput, Tour, TourInput, TourService, TourStatus } from './tour.service';

type NavItem = {
  label: string;
  icon: string;
  badge?: string;
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
  protected readonly tours = signal<Tour[]>([]);
  protected readonly slides = signal<Slide[]>([]);
  protected readonly isAuthenticated = signal(false);
  protected readonly isAuthChecking = signal(true);
  protected readonly isBusy = signal(false);
  protected readonly setupRequired = signal(false);
  protected readonly notice = signal('');
  protected readonly errorMessage = signal('');

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

  protected readonly nextTour = computed(() =>
    this.tours().find((tour) => Boolean(tour.departureDate)),
  );

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

  protected tourInitials(title: string): string {
    return title
      .split(' ')
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('');
  }

  protected statusLabel(status: TourStatus): string {
    return { published: 'Yayinda', draft: 'Taslak', upcoming: 'Yakinda' }[status];
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

  private async loadTours(): Promise<void> {
    try {
      this.tours.set(await firstValueFrom(this.tourService.list()));
      this.setupRequired.set(false);
    } catch (error) {
      const response = error as HttpErrorResponse;
      if (response.error?.code === 'SETUP_REQUIRED') {
        this.setupRequired.set(true);
        return;
      }
      this.errorMessage.set(this.errorText(error, 'Turlar yuklenemedi.'));
    }
  }

  private async loadSlides(): Promise<void> {
    try {
      this.slides.set(await firstValueFrom(this.tourService.listSlides()));
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Sliderlar yuklenemedi.'));
    }
  }

  private async loadContent(): Promise<void> {
    await Promise.all([this.loadTours(), this.loadSlides()]);
  }

  private errorText(error: unknown, fallback: string): string {
    const response = error as HttpErrorResponse;
    return typeof response.error?.message === 'string' ? response.error.message : fallback;
  }
}
