import {
  VocabulariesSchema,
  VocabularySchema,
  type Vocabulary,
} from "#/schema";
import { createServerFn } from "@tanstack/react-start";
import fs from "node:fs";
import path from "node:path";

const VOCABULARY_FILE_PATH = path.join(
  process.cwd(),
  "src/data/vocabulary.json",
);

export const getVocabulariesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const file = await fs.promises.readFile(VOCABULARY_FILE_PATH, "utf-8");
  const result = await VocabulariesSchema.safeParseAsync(JSON.parse(file));

  if (result.success) {
    return result.data;
  }

  throw new Error(result.error.message, { cause: result });
});

export const updateVocabularyServerFn = createServerFn({
  method: "POST",
})
  .validator(VocabularySchema)
  .handler(async ({ data }) => {
    const vocabularies = await getVocabulariesServerFn();

    const itemIndex = vocabularies.findIndex((item) => item.id === data.id);

    if (itemIndex === -1) {
      throw new Error(`Vocabulary with ID "${data.id}" not found.`);
    }

    const payload = vocabularies.map((item) =>
      item.id === data.id ? data : item,
    );

    await fs.promises.writeFile(
      VOCABULARY_FILE_PATH,
      JSON.stringify(payload, null, 2),
      "utf-8",
    );

    return {
      success: true,
      message: "Vocabulary updated successfully",
      data: data,
    };
  });

export const insertVocabularyIds = createServerFn().handler(async () => {
  try {
    const file = await fs.promises.readFile(VOCABULARY_FILE_PATH, "utf-8");
    const results = JSON.parse(file) as Omit<Vocabulary, "id">[];

    const payload = results.map((rest) => ({
      id: crypto.randomUUID(),
      ...rest,
    }));

    await fs.promises.writeFile(
      VOCABULARY_FILE_PATH,
      JSON.stringify(payload, null, 2),
      "utf-8",
    );

    return {
      success: true,
      message: `Successfully insert ID to ${payload.length} item.`,
      data: payload,
    };
  } catch (error) {
    throw new Error("Failed insert id", { cause: error });
  }
});
