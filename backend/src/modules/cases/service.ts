import { z } from "zod";
import { pool } from "../../db/pool";
import { assertCaseExists, buildCaseSelect } from "../../db/sql";
import {
  type CaseBundle,
  type CaseRecord,
  caseStatuses,
  issueTypes,
} from "../../lib/domain";
import { AppError } from "../../lib/http";

const coordinatesSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .nullable()
  .optional();

export const caseFiltersSchema = z.object({
  status: z.enum(caseStatuses).optional(),
  municipality: z.string().trim().min(1).optional(),
  issueType: z.enum(issueTypes).optional(),
  search: z.string().trim().min(1).optional(),
});

export const createCaseSchema = z.object({
  title: z.string().trim().min(3),
  municipality: z.string().trim().min(2),
  location_text: z.string().trim().max(255).nullable().optional(),
  gnr_bnr: z.string().trim().max(120).nullable().optional(),
  coordinates: coordinatesSchema,
  issue_type: z.enum(issueTypes).default("annet"),
  current_status: z.enum(caseStatuses).default("ny"),
  desired_outcome: z.string().trim().max(5000).nullable().optional(),
  summary: z.string().trim().max(10000).nullable().optional(),
});

export const updateCaseSchema = createCaseSchema.partial();

function normalizeCaseRow(row: Record<string, unknown>): CaseRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    municipality: String(row.municipality),
    location_text: (row.location_text as string | null) ?? null,
    gnr_bnr: (row.gnr_bnr as string | null) ?? null,
    coordinates: (row.coordinates as CaseRecord["coordinates"]) ?? null,
    issue_type: String(row.issue_type),
    current_status: String(row.current_status),
    desired_outcome: (row.desired_outcome as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listCases(filters: z.infer<typeof caseFiltersSchema>) {
  const where: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    values.push(filters.status);
    where.push(`current_status = $${values.length}`);
  }

  if (filters.municipality) {
    values.push(`%${filters.municipality}%`);
    where.push(`municipality ILIKE $${values.length}`);
  }

  if (filters.issueType) {
    values.push(filters.issueType);
    where.push(`issue_type = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`title ILIKE $${values.length}`);
  }

  const sql = `
    ${buildCaseSelect()}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC, created_at DESC
  `;

  const result = await pool.query(sql, values);
  return result.rows.map(normalizeCaseRow);
}

export async function createCase(input: z.infer<typeof createCaseSchema>) {
  const values = [
    input.title,
    input.municipality,
    input.location_text ?? null,
    input.gnr_bnr ?? null,
    input.coordinates?.lng ?? null,
    input.coordinates?.lat ?? null,
    input.issue_type ?? "annet",
    input.current_status ?? "ny",
    input.desired_outcome ?? null,
    input.summary ?? null,
  ];

  const result = await pool.query(
    `
      INSERT INTO cases (
        title,
        municipality,
        location_text,
        gnr_bnr,
        coordinates,
        issue_type,
        current_status,
        desired_outcome,
        summary
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        CASE
          WHEN $5::double precision IS NULL OR $6::double precision IS NULL THEN NULL
          ELSE ST_SetSRID(ST_MakePoint($5::double precision, $6::double precision), 4326)
        END,
        $7,
        $8,
        $9,
        $10
      )
      RETURNING
        id,
        title,
        municipality,
        location_text,
        gnr_bnr,
        CASE
          WHEN coordinates IS NULL THEN NULL
          ELSE json_build_object('lat', ST_Y(coordinates), 'lng', ST_X(coordinates))
        END AS coordinates,
        issue_type,
        current_status,
        desired_outcome,
        summary,
        created_at,
        updated_at
    `,
    values,
  );

  return normalizeCaseRow(result.rows[0]);
}

export async function getCase(caseId: string) {
  const result = await pool.query(
    `
      ${buildCaseSelect()}
      WHERE id = $1
      LIMIT 1
    `,
    [caseId],
  );

  if (result.rowCount === 0) {
    throw new AppError(404, "CASE_NOT_FOUND", "Fant ikke sak");
  }

  const counts = await pool.query(
    `
      SELECT
        (SELECT COUNT(*) FROM case_interview_answers WHERE case_id = $1) AS interview_answers,
        (SELECT COUNT(*) FROM case_evidence WHERE case_id = $1) AS evidence,
        (SELECT COUNT(*) FROM case_sources WHERE case_id = $1) AS sources,
        (SELECT COUNT(*) FROM case_timeline_events WHERE case_id = $1) AS timeline_events,
        (SELECT COUNT(*) FROM map_observations WHERE case_id = $1) AS map_observations,
        (SELECT COUNT(*) FROM case_output WHERE case_id = $1) AS outputs
    `,
    [caseId],
  );

  return {
    case: normalizeCaseRow(result.rows[0]),
    counts: counts.rows[0],
  };
}

export async function updateCase(caseId: string, input: z.infer<typeof updateCaseSchema>) {
  await assertCaseExists(caseId);

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    values.push(input.title);
    updates.push(`title = $${values.length}`);
  }

  if (input.municipality !== undefined) {
    values.push(input.municipality);
    updates.push(`municipality = $${values.length}`);
  }

  if (input.location_text !== undefined) {
    values.push(input.location_text);
    updates.push(`location_text = $${values.length}`);
  }

  if (input.gnr_bnr !== undefined) {
    values.push(input.gnr_bnr);
    updates.push(`gnr_bnr = $${values.length}`);
  }

  if (input.issue_type !== undefined) {
    values.push(input.issue_type);
    updates.push(`issue_type = $${values.length}`);
  }

  if (input.current_status !== undefined) {
    values.push(input.current_status);
    updates.push(`current_status = $${values.length}`);
  }

  if (input.desired_outcome !== undefined) {
    values.push(input.desired_outcome);
    updates.push(`desired_outcome = $${values.length}`);
  }

  if (input.summary !== undefined) {
    values.push(input.summary);
    updates.push(`summary = $${values.length}`);
  }

  if (input.coordinates !== undefined) {
    values.push(input.coordinates?.lng ?? null);
    values.push(input.coordinates?.lat ?? null);
    updates.push(
      `coordinates = CASE
        WHEN $${values.length - 1}::double precision IS NULL OR $${values.length}::double precision IS NULL THEN NULL
        ELSE ST_SetSRID(ST_MakePoint($${values.length - 1}::double precision, $${values.length}::double precision), 4326)
      END`,
    );
  }

  if (!updates.length) {
    return (await getCase(caseId)).case;
  }

  values.push(caseId);

  const result = await pool.query(
    `
      UPDATE cases
      SET ${updates.join(", ")}
      WHERE id = $${values.length}
      RETURNING
        id,
        title,
        municipality,
        location_text,
        gnr_bnr,
        CASE
          WHEN coordinates IS NULL THEN NULL
          ELSE json_build_object('lat', ST_Y(coordinates), 'lng', ST_X(coordinates))
        END AS coordinates,
        issue_type,
        current_status,
        desired_outcome,
        summary,
        created_at,
        updated_at
    `,
    values,
  );

  return normalizeCaseRow(result.rows[0]);
}

export async function getCaseBundle(caseId: string): Promise<CaseBundle> {
  const caseResult = await pool.query(
    `
      ${buildCaseSelect()}
      WHERE id = $1
      LIMIT 1
    `,
    [caseId],
  );

  if (caseResult.rowCount === 0) {
    throw new AppError(404, "CASE_NOT_FOUND", "Fant ikke sak");
  }

  const [interviewAnswers, evidence, sources, timeline, analysis, outputs, mapObservations] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          case_id,
          question_key,
          question_text,
          answer_text,
          summary,
          extracted_user_statement,
          extracted_documented_fact,
          extracted_uncertainty,
          extracted_possible_issue,
          created_at
        FROM case_interview_answers
        WHERE case_id = $1
        ORDER BY created_at ASC
      `,
      [caseId],
    ),
    pool.query(
      `
        SELECT
          id,
          case_id,
          title,
          evidence_type,
          source_label,
          source_url,
          evidence_date,
          description,
          supports_point,
          reliability_level,
          verification_status,
          storage_path,
          file_name,
          mime_type,
          file_size_bytes,
          created_at
        FROM case_evidence
        WHERE case_id = $1
        ORDER BY created_at DESC
      `,
      [caseId],
    ),
    pool.query(
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
    ),
    pool.query(
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
    ),
    pool.query(
      `
        SELECT
          id,
          case_id,
          known_facts,
          uncertainties,
          possible_issues,
          missing_information,
          recommended_next_steps,
          created_at,
          updated_at
        FROM case_analysis
        WHERE case_id = $1
        LIMIT 1
      `,
      [caseId],
    ),
    pool.query(
      `
        SELECT
          id,
          case_id,
          output_type,
          content,
          created_at,
          updated_at
        FROM case_output
        WHERE case_id = $1
        ORDER BY updated_at DESC
      `,
      [caseId],
    ),
    pool.query(
      `
        SELECT
          id,
          case_id,
          title,
          description,
          geometry_json,
          source_label,
          created_at
        FROM map_observations
        WHERE case_id = $1
        ORDER BY created_at DESC
      `,
      [caseId],
    ),
  ]);

  return {
    caseRecord: normalizeCaseRow(caseResult.rows[0]),
    interviewAnswers: interviewAnswers.rows.map((row) => ({
      ...row,
      created_at: new Date(String(row.created_at)).toISOString(),
    })),
    evidence: evidence.rows.map((row) => ({
      ...row,
      evidence_date: row.evidence_date ? String(row.evidence_date) : null,
      created_at: new Date(String(row.created_at)).toISOString(),
    })),
    sources: sources.rows.map((row) => ({
      ...row,
      publication_date: row.publication_date ? String(row.publication_date) : null,
      created_at: new Date(String(row.created_at)).toISOString(),
    })),
    timeline: timeline.rows.map((row) => ({
      ...row,
      event_date: String(row.event_date),
      created_at: new Date(String(row.created_at)).toISOString(),
    })),
    analysis: analysis.rows[0]
      ? {
          ...analysis.rows[0],
          created_at: new Date(String(analysis.rows[0].created_at)).toISOString(),
          updated_at: new Date(String(analysis.rows[0].updated_at)).toISOString(),
        }
      : null,
    outputs: outputs.rows.map((row) => ({
      ...row,
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    })),
    mapObservations: mapObservations.rows.map((row) => ({
      ...row,
      created_at: new Date(String(row.created_at)).toISOString(),
    })),
  };
}
