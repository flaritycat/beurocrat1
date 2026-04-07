import { z } from "zod";
import { pool } from "../../db/pool";
import { assertCaseExists } from "../../db/sql";
import { certaintyLevels } from "../../lib/domain";

export const createTimelineEventSchema = z.object({
  event_date: z.string().date(),
  title: z.string().trim().min(2),
  description: z.string().trim().max(10000).nullable().optional(),
  source_reference: z.string().trim().max(255).nullable().optional(),
  certainty_level: z.enum(certaintyLevels).default("middels"),
});

export async function listTimeline(caseId: string) {
  await assertCaseExists(caseId);
  const result = await pool.query(
    `
      SELECT
        id,
        case_id,
        event_date,
        title,
        description,
        source_reference,
        certainty_level,
        created_at
      FROM case_timeline_events
      WHERE case_id = $1
      ORDER BY event_date ASC, created_at ASC
    `,
    [caseId],
  );

  return result.rows.map((row) => ({
    ...row,
    event_date: String(row.event_date),
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function createTimelineEvent(caseId: string, input: z.infer<typeof createTimelineEventSchema>) {
  await assertCaseExists(caseId);
  const result = await pool.query(
    `
      INSERT INTO case_timeline_events (
        case_id,
        event_date,
        title,
        description,
        source_reference,
        certainty_level
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        case_id,
        event_date,
        title,
        description,
        source_reference,
        certainty_level,
        created_at
    `,
    [
      caseId,
      input.event_date,
      input.title,
      input.description ?? null,
      input.source_reference ?? null,
      input.certainty_level ?? "middels",
    ],
  );

  return result.rows[0];
}
