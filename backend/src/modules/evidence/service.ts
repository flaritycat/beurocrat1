import { z } from "zod";
import { pool } from "../../db/pool";
import { assertCaseExists } from "../../db/sql";
import { evidenceTypes, reliabilityLevels, verificationStatuses } from "../../lib/domain";

const manualEvidenceTypes = evidenceTypes.filter((type) => type !== "fil") as [
  "dokument" | "lenke" | "notat" | "kartobservasjon" | "annet",
  ...Array<"dokument" | "lenke" | "notat" | "kartobservasjon" | "annet">,
];

export const createEvidenceSchema = z.object({
  title: z.string().trim().min(2),
  evidence_type: z.enum(manualEvidenceTypes),
  source_label: z.string().trim().max(255).nullable().optional(),
  source_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  evidence_date: z.string().date().nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  supports_point: z.string().trim().max(5000).nullable().optional(),
  reliability_level: z.enum(reliabilityLevels).default("middels"),
  verification_status: z.enum(verificationStatuses).default("ubekreftet"),
});

function normalizeOptionalUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value;
}

export async function listEvidence(caseId: string) {
  await assertCaseExists(caseId);
  const result = await pool.query(
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
  );

  return result.rows.map((row) => ({
    ...row,
    evidence_date: row.evidence_date ? String(row.evidence_date) : null,
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
}

export async function createEvidence(caseId: string, input: z.infer<typeof createEvidenceSchema>) {
  await assertCaseExists(caseId);
  const result = await pool.query(
    `
      INSERT INTO case_evidence (
        case_id,
        title,
        evidence_type,
        source_label,
        source_url,
        evidence_date,
        description,
        supports_point,
        reliability_level,
        verification_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
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
    `,
    [
      caseId,
      input.title,
      input.evidence_type,
      input.source_label ?? null,
      normalizeOptionalUrl(input.source_url ?? null),
      input.evidence_date ?? null,
      input.description ?? null,
      input.supports_point ?? null,
      input.reliability_level ?? "middels",
      input.verification_status ?? "ubekreftet",
    ],
  );

  return result.rows[0];
}
