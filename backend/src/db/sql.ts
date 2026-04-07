import { AppError } from "../lib/http";
import { pool } from "./pool";

const caseSelect = `
  SELECT
    id,
    title,
    municipality,
    location_text,
    gnr_bnr,
    CASE
      WHEN coordinates IS NULL THEN NULL
      ELSE json_build_object(
        'lat', ST_Y(coordinates),
        'lng', ST_X(coordinates)
      )
    END AS coordinates,
    issue_type,
    current_status,
    desired_outcome,
    summary,
    created_at,
    updated_at
  FROM cases
`;

export function buildCaseSelect(alias?: string) {
  if (!alias) {
    return caseSelect;
  }

  return `
    SELECT
      ${alias}.id,
      ${alias}.title,
      ${alias}.municipality,
      ${alias}.location_text,
      ${alias}.gnr_bnr,
      CASE
        WHEN ${alias}.coordinates IS NULL THEN NULL
        ELSE json_build_object(
          'lat', ST_Y(${alias}.coordinates),
          'lng', ST_X(${alias}.coordinates)
        )
      END AS coordinates,
      ${alias}.issue_type,
      ${alias}.current_status,
      ${alias}.desired_outcome,
      ${alias}.summary,
      ${alias}.created_at,
      ${alias}.updated_at
    FROM cases ${alias}
  `;
}

export async function assertCaseExists(caseId: string) {
  const result = await pool.query("SELECT id FROM cases WHERE id = $1", [caseId]);

  if (result.rowCount === 0) {
    throw new AppError(404, "CASE_NOT_FOUND", "Fant ikke sak");
  }
}
