import { z } from "zod";
import { pool } from "../../db/pool";
import { assertCaseExists } from "../../db/sql";
import { authorityLevels, sourceTypes } from "../../lib/domain";

export const createSourceSchema = z.object({
  title: z.string().trim().min(2),
  publisher: z.string().trim().max(255).nullable().optional(),
  source_type: z.enum(sourceTypes),
  source_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  publication_date: z.string().date().nullable().optional(),
  authority_level: z.enum(authorityLevels).default("kontekstuell"),
  notes: z.string().trim().max(10000).nullable().optional(),
});

export async function listSources(caseId: string) {
  await assertCaseExists(caseId);
  const result = await pool.query(
    `
      SELECT
        id,
        case_id,
        title,
        publisher,
        source_type,
        source_url,
        publication_date,
        authority_level,
        notes,
        created_at
      FROM case_sources
      WHERE case_id = $1
      ORDER BY created_at DESC
    `,
    [caseId],
  );

  return result.rows.map((row) => ({
    ...row,
    publication_date: row.publication_date ? String(row.publication_date) : null,
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function createSource(caseId: string, input: z.infer<typeof createSourceSchema>) {
  await assertCaseExists(caseId);
  const result = await pool.query(
    `
      INSERT INTO case_sources (
        case_id,
        title,
        publisher,
        source_type,
        source_url,
        publication_date,
        authority_level,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        case_id,
        title,
        publisher,
        source_type,
        source_url,
        publication_date,
        authority_level,
        notes,
        created_at
    `,
    [
      caseId,
      input.title,
      input.publisher ?? null,
      input.source_type,
      input.source_url || null,
      input.publication_date ?? null,
      input.authority_level ?? "kontekstuell",
      input.notes ?? null,
    ],
  );

  return result.rows[0];
}
