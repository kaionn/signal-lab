import fs from "fs";
import path from "path";
import { parse } from "yaml";
import { z } from "zod";

const EXPERIMENTS_DIR = path.join(process.cwd(), "experiments");

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const PainSourceSchema = z.object({
  repo: z.string().optional(),
  issue: z.number().optional(),
  source_url: z.string().url().nullable().optional(),
});

const DistributionEntrySchema = z.object({
  date: z.string(),
  channel: z.string(),
  url: z.string().optional(),
});

export const ExperimentMetaSchema = z.object({
  slug: z.string().regex(SLUG_REGEX, "slug must be kebab-case"),
  title: z.string(),
  tagline: z.string(),
  probe_type: z.enum(["A", "B"]),
  status: z.enum(["draft", "live", "killed", "graduated"]),
  created: z.string().regex(DATE_REGEX, "created must be YYYY-MM-DD"),
  pain_source: PainSourceSchema.optional(),
  price_hypothesis: z.string().optional(),
  cta: z.enum(["waitlist", "preorder", "pro_interest"]),
  distribution: z.array(DistributionEntrySchema).default([]),
  verdict_log: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type ExperimentMeta = z.infer<typeof ExperimentMetaSchema>;

export function getAllExperiments(): ExperimentMeta[] {
  if (!fs.existsSync(EXPERIMENTS_DIR)) {
    return [];
  }

  const entries = fs
    .readdirSync(EXPERIMENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"));

  return entries.map((entry) => {
    const dirName = entry.name;
    const metaPath = path.join(EXPERIMENTS_DIR, dirName, "meta.yaml");

    if (!fs.existsSync(metaPath)) {
      throw new Error(`experiments/${dirName}/meta.yaml が見つかりません`);
    }

    const raw = parse(fs.readFileSync(metaPath, "utf-8"));
    const result = ExperimentMetaSchema.safeParse(raw);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new Error(
        `experiments/${dirName}/meta.yaml のバリデーションに失敗しました: ${issues}`,
      );
    }

    if (result.data.slug !== dirName) {
      throw new Error(
        `experiments/${dirName}/meta.yaml の slug "${result.data.slug}" がディレクトリ名 "${dirName}" と一致しません`,
      );
    }

    return result.data;
  });
}

export function getLiveExperiments(): ExperimentMeta[] {
  return getAllExperiments().filter((experiment) => experiment.status === "live");
}
