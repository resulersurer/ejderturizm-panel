import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type TourStatus = 'YayÄ±nda' | 'Taslak' | 'YakÄ±nda';

type Tour = {
  id: number;
  title: string;
  destination: string;
  date: string;
  price: string;
  status: TourStatus;
};

type NavItem = {
  label: string;
  icon: string;
  badge?: string;
};

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly isSidebarOpen = signal(false);
  protected readonly isTourDialogOpen = signal(false);
  protected readonly activeSection = signal('Genel BakÄ±ÅŸ');
  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal('TÃ¼mÃ¼');

  protected readonly primaryNavigation: NavItem[] = [
    { label: 'Genel BakÄ±ÅŸ', icon: 'dashboard' },
    { label: 'Turlar', icon: 'travel_explore', badge: '12' },
    { label: 'Slider', icon: 'image' },
    { label: 'Kategoriler', icon: 'category' },
    { label: 'Destinasyonlar', icon: 'location_on' },
  ];

  protected readonly contentNavigation: NavItem[] = [
    { label: 'Kampanyalar', icon: 'campaign', badge: '3' },
    { label: 'Blog YazÄ±larÄ±', icon: 'article' },
    { label: 'Misafir YorumlarÄ±', icon: 'star', badge: '5' },
  ];

  protected readonly tours = signal<Tour[]>([
    {
      id: 1,
      title: 'Karadeniz Batum Turu',
      destination: 'Trabzon - Rize - Batum',
      date: '18 AÄŸustos 2026',
      price: '18.900 TL',
      status: 'YayÄ±nda',
    },
    {
      id: 2,
      title: 'Kapadokya Balon Deneyimi',
      destination: 'NevÅŸehir',
      date: '22 AÄŸustos 2026',
      price: '12.750 TL',
      status: 'YayÄ±nda',
    },
    {
      id: 3,
      title: 'BÃ¼yÃ¼k Balkan Turu',
      destination: '7 Ãœlke',
      date: '04 EylÃ¼l 2026',
      price: '799 EUR',
      status: 'YakÄ±nda',
    },
    {
      id: 4,
      title: 'Ege KoylarÄ± RotasÄ±',
      destination: 'Ä°zmir - MuÄŸla',
      date: '12 EylÃ¼l 2026',
      price: '16.400 TL',
      status: 'Taslak',
    },
    {
      id: 5,
      title: 'DoÄŸu Ekspresi ve Kars',
      destination: 'Ankara - Kars',
      date: '18 AralÄ±k 2026',
      price: '21.500 TL',
      status: 'Taslak',
    },
  ]);

  protected readonly filteredTours = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('tr-TR');
    const status = this.statusFilter();

    return this.tours().filter((tour) => {
      const matchesTerm =
        !term ||
        tour.title.toLocaleLowerCase('tr-TR').includes(term) ||
        tour.destination.toLocaleLowerCase('tr-TR').includes(term);
      const matchesStatus = status === 'TÃ¼mÃ¼' || tour.status === status;

      return matchesTerm && matchesStatus;
    });
  });

  protected readonly publishedTourCount = computed(
    () => this.tours().filter((tour) => tour.status === 'YayÄ±nda').length,
  );

  protected draftTour = {
    title: '',
    destination: '',
    date: '',
    price: '',
  };

  protected selectSection(label: string): void {
    this.activeSection.set(label);
    this.isSidebarOpen.set(false);
  }

  protected toggleSidebar(): void {
    this.isSidebarOpen.update((isOpen) => !isOpen);
  }

  protected openTourDialog(): void {
    this.isTourDialogOpen.set(true);
  }

  protected closeTourDialog(): void {
    this.isTourDialogOpen.set(false);
    this.resetDraftTour();
  }

  protected createTour(): void {
    if (!this.draftTour.title.trim() || !this.draftTour.destination.trim()) {
      return;
    }

    const nextId = Math.max(...this.tours().map((tour) => tour.id), 0) + 1;
    this.tours.update((tours) => [
      {
        id: nextId,
        title: this.draftTour.title.trim(),
        destination: this.draftTour.destination.trim(),
        date: this.draftTour.date || 'Tarih belirlenmedi',
        price: this.draftTour.price || 'Fiyat belirlenmedi',
        status: 'Taslak',
      },
      ...tours,
    ]);
    this.closeTourDialog();
  }

  protected toggleTourStatus(tourId: number): void {
    this.tours.update((tours) =>
      tours.map((tour) =>
        tour.id === tourId
          ? { ...tour, status: tour.status === 'YayÄ±nda' ? 'Taslak' : 'YayÄ±nda' }
          : tour,
      ),
    );
  }

  protected deleteTour(tourId: number): void {
    this.tours.update((tours) => tours.filter((tour) => tour.id !== tourId));
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updateStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
  }

  protected tourInitials(title: string): string {
    return title
      .split(' ')
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('');
  }

  private resetDraftTour(): void {
    this.draftTour = { title: '', destination: '', date: '', price: '' };
  }
}

