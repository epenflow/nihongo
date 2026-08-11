export type CardState = "new" | "learning" | "review" | "relearning";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type NoteType = "basic" | "cloze" | "reverse";

export type DeckId = string;
export type NoteId = string;
export type CardId = string;

export interface DeckConfig {
  id: string;
  name: string;
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  learningSteps: number[]; // Contoh: [1, 10] dalam menit
  passingGradeEase: number; // Default multiplier (misal: 2.5)
}

export interface Deck {
  id: DeckId;
  name: string;
  description?: string;
  parentId: DeckId | null; // Untuk mendukung sub-deck
  configId: string; // Referensi ke konfigurasi deck
  createdAt: number;
  updatedAt: number;
}

export interface CardTemplate {
  name: string; // Contoh: "Card 1 (Forward)", "Card 2 (Reverse)"
  frontFormat: string; // Format template sisi depan (mendukung HTML/Markdown)
  backFormat: string; // Format template sisi belakang
}

export interface NoteModel {
  id: string;
  name: string; // Nama tipe note (misal: "Standard", "Cloze Deletion")
  type: NoteType;
  templates: CardTemplate[];
  fields: string[]; // Daftar nama field yang tersedia (contoh: ["Front", "Back", "Hint"])
}

export interface Note {
  id: NoteId;
  deckId: DeckId;
  modelId: string; // Referensi ke NoteModel
  fields: Record<string, string>; // Dynamic key berdasarkan model fields (misal: { Front: "...", Back: "..." })
  tags: string[]; // Sistem tag untuk organisasi fleksibel
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: CardId;
  noteId: NoteId;
  deckId: DeckId; // Bisa dipindah ke deck lain (pindah tangan)
  templateIndex: number; // Menandakan card ke-X dari note model tertentu
  state: CardState;

  // Penjadwalan Anki (SM-2 / FSRS compatible fields)
  due: number; // Timestamp target review berikutnya (atau nomor hari jika berbasis hari)
  interval: number; // Jarak waktu dalam hari
  repetition: number; // Jumlah sukses berturut-turut
  easeFactor: number; // Faktor kemudahan (misal: 2.50)

  // Statistik
  lapses: number; // Berapa kali kartu jatuh ke status 'again'
  reviewsCount: number; // Total berapa kali kartu ini di-review
  lastReviewedAt?: number; // Timestamp review terakhir
}

// Log setiap kali user menekan tombol rating (untuk grafik statistik & retensi)
export interface ReviewLog {
  id: string;
  cardId: CardId;
  rating: ReviewRating;
  stateBefore: CardState;
  stateAfter: CardState;
  intervalBefore: number;
  intervalAfter: number;
  easeFactorBefore: number;
  easeFactorAfter: number;
  reviewDurationMs: number; // Berapa lama user berpikir (dalam milidetik)
  reviewedAt: number; // Timestamp kejadian
}

export interface FlashcardAppState {
  decks: Record<DeckId, Deck>;
  deckConfigs: Record<string, DeckConfig>;
  noteModels: Record<string, NoteModel>;
  notes: Record<NoteId, Note>;
  cards: Record<CardId, Card>;
  reviewLogs: Record<string, ReviewLog>; // Atau array of logs

  // UI State pendukung
  settings: {
    activeDeckId: DeckId | null;
    currentTheme: "light" | "dark";
  };
}
