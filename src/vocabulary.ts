import { z } from "zod";

export const VocabularyCategorySchema = z.enum([
  "Verb1",
  "Verb2",
  "Verb3",
  "Noun",
  "AdjI",
  "AdjNa",
  "Adverb",
  "Expression",
  "Conjunction",
  "Suffix",
]);

const BaseFormSchema = z.object({
  positive: z.string().nullish(),
  negative: z.string().nullish(),
});
const VocabularyBaseFormSchema = z.object({
  polite: z
    .object({
      past: BaseFormSchema.nullish(),
      present: BaseFormSchema.nullish(),
    })
    .nullish(),
  plain: z
    .object({
      past: BaseFormSchema.nullish(),
      present: BaseFormSchema.nullish(),
    })
    .nullish(),
});

export const VocabularySchema = z.object({
  id: z.uuid(),
  dictionary: z.string(),
  meaning: z.union([z.array(z.string()), z.string()]),
  category: VocabularyCategorySchema,
  groups: z.array(z.uuid()).nullish(),
  lessons: z.array(z.uuid()).nullish(),
  tags: z.array(z.uuid()).nullish(),
  form: VocabularyBaseFormSchema.extend({
    imperative: z.string().nullish(),
  }).nullish(),
  modifiers: z.record(z.string(), z.any()).nullish(),
  metadata: z
    .object({
      example: z.array(z.string()).nullish(),
      romaji: z.string().nullish(),
    })
    .catchall(z.any())
    .nullish(),
});

export type Vocabulary = z.infer<typeof VocabularySchema>;

export const vocabularies: Vocabulary[] = [
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    dictionary: "食べる",
    meaning: "makan",
    category: "Verb2",
    groups: ["9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"],
    lessons: ["a1b2c3d4-e5f6-7890-abcd-ef0123456789"],
    tags: ["f9e8d7c6-b5a4-3210-fedc-ba9876543210"],
    form: {
      plain: {
        present: { positive: "食べる", negative: "食べない" },
        past: { positive: "食べた", negative: "食べなかった" },
      },
      polite: {
        present: { positive: "食べます", negative: "食べません" },
        past: { positive: "食べました", negative: "食べませんでした" },
      },
      imperative: "食べろ",
    },
    metadata: {
      romaji: "taberu",
      example: ["りんごを**食べます**。", "朝ごはんを**食べません**でした。"],
    },
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    dictionary: "行く",
    meaning: "pergi",
    category: "Verb1",
    groups: ["9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"],
    lessons: ["a1b2c3d4-e5f6-7890-abcd-ef0123456789"],
    form: {
      plain: {
        present: { positive: "行く", negative: "行かない" },
        past: { positive: "行った", negative: "行かなかった" },
      },
      polite: {
        present: { positive: "行きます", negative: "行きません" },
        past: { positive: "行きました", negative: "行きませんでした" },
      },
      imperative: "行け",
    },
    metadata: {
      romaji: "iku",
      example: ["明日、東京へ**行きます**。"],
    },
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174003",
    dictionary: "高い",
    meaning: ["mahal", "tinggi"],
    category: "AdjI",
    groups: ["9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e"],
    form: {
      plain: {
        present: { positive: "高い", negative: "高くない" },
        past: { positive: "高かった", negative: "高くなかった" },
      },
      polite: {
        present: { positive: "高いです", negative: "高くありません" },
        past: { positive: "高かったです", negative: "高くありませんでした" },
      },
    },
    metadata: {
      romaji: "takai",
      example: ["この車はとても**高い**です。"],
    },
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174004",
    dictionary: "きれい",
    meaning: ["cantik", "bersih"],
    category: "AdjNa",
    groups: ["9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6f"],
    form: {
      polite: {
        present: { positive: "きれい です", negative: "きれいではありません" },
        past: {
          positive: "きれいでした",
          negative: "きれいではありませんでした",
        },
      },
    },
    metadata: {
      romaji: "kirei",
      example: ["あの方の部屋はいつも**きれい**です。"],
    },
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174005",
    dictionary: "本",
    meaning: "buku",
    category: "Noun",
    metadata: {
      romaji: "hon",
      example: ["机の上に**本**があります。"],
    },
  },
];
