import { pool } from "../../db/pool";
import type { AnalysisRecord, CaseBundle } from "../../lib/domain";
import { getCaseBundle } from "../cases/service";

function uniqueList(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter(Boolean) as string[])];
}

function buildAnalysisFromBundle(bundle: CaseBundle) {
  const knownFacts = uniqueList([
    bundle.caseRecord.summary ?? undefined,
    ...bundle.interviewAnswers.map((answer) => answer.extracted_documented_fact ?? undefined),
    ...bundle.evidence.map((item) => item.title),
    ...bundle.timeline.map((item) => `${item.event_date}: ${item.title}`),
  ]);

  const uncertainties = uniqueList([
    ...bundle.interviewAnswers.map((answer) => answer.extracted_uncertainty ?? undefined),
    ...bundle.mapObservations.map((item) => item.description ?? undefined),
  ]);

  const possibleIssues = uniqueList([
    ...bundle.interviewAnswers.map((answer) => answer.extracted_possible_issue ?? undefined),
    bundle.caseRecord.issue_type === "byggesak"
      ? "Det kan være grunn til å kontrollere om byggesaksgrunnlaget er tilstrekkelig opplyst."
      : undefined,
    bundle.evidence.some((item) => item.verification_status === "ubekreftet")
      ? "Flere bevisposter er fortsatt uverifiserte og bør kontrolleres."
      : undefined,
  ]);

  const missingInformation = uniqueList([
    bundle.interviewAnswers.some((answer) => answer.question_key === "dokumentasjon")
      ? undefined
      : "Det mangler fortsatt svar på dokumentasjonsspørsmålet.",
    bundle.sources.length === 0 ? "Relevante kilder og regelgrunnlag er ikke registrert." : undefined,
    bundle.timeline.length === 0 ? "Tidslinjen er ikke fylt ut." : undefined,
    bundle.evidence.length === 0 ? "Det er ikke registrert konkrete bevisposter." : undefined,
  ]);

  const recommendedNextSteps = uniqueList([
    "Sammenstill brukerutsagn mot dokumenterte fakta før endelig klageformulering.",
    bundle.evidence.some((item) => item.verification_status !== "verifisert")
      ? "Vurder hvilke bevisposter som kan verifiseres ytterligere."
      : undefined,
    bundle.sources.length < 2 ? "Registrer flere autoritative kilder for å styrke vurderingsgrunnlaget." : undefined,
    "Vurder innsynsbegjæring dersom sentrale dokumenter mangler.",
  ]);

  return {
    knownFacts,
    uncertainties,
    possibleIssues,
    missingInformation,
    recommendedNextSteps,
  };
}

export async function analyzeCase(caseId: string): Promise<AnalysisRecord> {
  const bundle = await getCaseBundle(caseId);
  const generated = buildAnalysisFromBundle(bundle);

  const result = await pool.query(
    `
      INSERT INTO case_analysis (
        case_id,
        known_facts,
        uncertainties,
        possible_issues,
        missing_information,
        recommended_next_steps
      )
      VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
      ON CONFLICT (case_id)
      DO UPDATE SET
        known_facts = EXCLUDED.known_facts,
        uncertainties = EXCLUDED.uncertainties,
        possible_issues = EXCLUDED.possible_issues,
        missing_information = EXCLUDED.missing_information,
        recommended_next_steps = EXCLUDED.recommended_next_steps
      RETURNING
        id,
        case_id,
        known_facts,
        uncertainties,
        possible_issues,
        missing_information,
        recommended_next_steps,
        created_at,
        updated_at
    `,
    [
      caseId,
      JSON.stringify(generated.knownFacts),
      JSON.stringify(generated.uncertainties),
      JSON.stringify(generated.possibleIssues),
      JSON.stringify(generated.missingInformation),
      JSON.stringify(generated.recommendedNextSteps),
    ],
  );

  const row = result.rows[0];
  return {
    ...row,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function getAnalysis(caseId: string) {
  const result = await pool.query(
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
  );

  if (!result.rowCount) {
    return null;
  }

  return {
    ...result.rows[0],
    created_at: new Date(String(result.rows[0].created_at)).toISOString(),
    updated_at: new Date(String(result.rows[0].updated_at)).toISOString(),
  };
}
