import { z } from "zod";

/**
 * Zod Schema untuk VocabularySection
 */
export const VocabularySectionSchema = z.enum([
  "vocabulary",
  "renshuu_c",
  "kaiwa",
  "reference",
]);

/**
 * Zod Schema untuk VocabularyType
 */
export const VocabularyTypeSchema = z.enum([
  "verb_g1",
  "verb_g2",
  "verb_g3",
  "adj_i",
  "adj_na",
  "noun",
  "adverb",
  "expression",
  "conjunction",
  "suffix",
]);

/**
 * Zod Schema untuk satu entri data kosakata (Vocabulary)
 */
export const VocabularySchema = z.object({
  id: z.uuid(),
  chapter: z.number().int().min(1).max(25),
  section: VocabularySectionSchema,
  kanji: z.string().optional(),
  reading: z.string().min(1),
  furigana: z.string().optional(),
  meaning: z.string().min(1),
  type: VocabularyTypeSchema,
});

/**
 * Zod Schema untuk list/array kosakata (Vocabularies)
 */
export const VocabulariesSchema = z.array(VocabularySchema);

// Inferred TypeScript Types dari Zod Schema (Opsional jika ingin mengekspor tipe data langsung dari Zod)
export type VocabularySection = z.infer<typeof VocabularySectionSchema>;
export type VocabularyType = z.infer<typeof VocabularyTypeSchema>;
export type Vocabulary = z.infer<typeof VocabularySchema>;
export type Vocabularies = z.infer<typeof VocabulariesSchema>;

export const VocalbularyTypeIDMap: Record<VocabularyType, string> = {
  verb_g1: "Kata Kerja I (Godan)",
  verb_g2: "Kata Kerja II (Ichidan)",
  verb_g3: "Kata Kerja III (Irreguler)",
  adj_i: "Kata Sifat -i",
  adj_na: "Kata Sifat -na",
  noun: "Kata Benda",
  adverb: "Kata Keterangan",
  expression: "Ungkapan",
  conjunction: "Kata Sambung",
  suffix: "Akhiran",
};

export function getVocabularyTypeID(type: VocabularyType) {
  return VocalbularyTypeIDMap[type];
}
