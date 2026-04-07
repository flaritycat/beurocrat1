import { z } from "zod";
import { pool } from "../../db/pool";
import { assertCaseExists } from "../../db/sql";
import { interviewQuestions, type CaseBundle, type InterviewAnswerRecord } from "../../lib/domain";
import { getCaseBundle } from "../cases/service";

export const answerInterviewSchema = z.object({
  question_key: z.enum(interviewQuestions.map((question) => question.key) as [string, ...string[]]),
  answer_text: z.string().trim().min(10).max(12000),
});

function summarizeText(answerText: string) {
  const compact = answerText.replace(/\s+/g, " ").trim();
  if (compact.length <= 220) {
    return compact;
  }

  return `${compact.slice(0, 217)}...`;
}

function detectDocumentedFact(answerText: string) {
  const indicators = ["vedtak", "brev", "e-post", "bild", "kart", "dokument", "vedlagt", "tegning", "dato"];
  const lower = answerText.toLowerCase();
  const hasIndicator = indicators.some((indicator) => lower.includes(indicator));

  if (!hasIndicator) {
    return "Ikke tydelig dokumentert i svaret alene. Bør knyttes til konkret kilde eller bevispost.";
  }

  return "Svaret viser til konkrete dokumenter, observasjoner eller datoer som kan verifiseres nærmere.";
}

function detectUncertainty(answerText: string) {
  const uncertaintyIndicators = ["tror", "mulig", "usikker", "virker", "ser ut til", "etter det jeg forstår", "kanskje"];
  const lower = answerText.toLowerCase();
  const hasIndicator = uncertaintyIndicators.some((indicator) => lower.includes(indicator));

  if (!hasIndicator) {
    return "Lite eksplisitt usikkerhet uttrykt i svaret, men faktagrunnlaget bør fortsatt kontrolleres.";
  }

  return "Svaret inneholder forhold som fremstår som foreløpige eller trenger bekreftelse.";
}

function mapPossibleIssue(questionKey: string, answerText: string) {
  const lower = answerText.toLowerCase();

  if (questionKey === "kommunens_handling") {
    return "Mulig behov for å kontrollere hva kommunen faktisk besluttet eller unnlot å gjøre.";
  }

  if (questionKey === "hvorfor_feil") {
    if (lower.includes("urimelig") || lower.includes("skad")) {
      return "Mulig uforholdsmessig virkning eller mangelfull interesseavveining.";
    }

    return "Mulig avvik mellom kommunens vurdering og brukerens beskrivelse av skade eller urimelighet.";
  }

  if (questionKey === "dokumentasjon") {
    return "Mulig dokumentmangel eller behov for bedre kildekobling.";
  }

  if (questionKey === "prosess_og_tid") {
    return "Mulig svakhet i saksbehandling, begrunnelse, fremdrift eller innsynshåndtering.";
  }

  return "Mulig behov for å avklare hvilket formelt spor som er mest hensiktsmessig videre.";
}

function buildClassification(questionKey: string, answerText: string) {
  return {
    summary: summarizeText(answerText),
    extracted_user_statement: summarizeText(answerText),
    extracted_documented_fact: detectDocumentedFact(answerText),
    extracted_uncertainty: detectUncertainty(answerText),
    extracted_possible_issue: mapPossibleIssue(questionKey, answerText),
  };
}

export async function getInterview(caseId: string) {
  await assertCaseExists(caseId);

  const result = await pool.query<InterviewAnswerRecord>(
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
  );

  const answerMap = new Map(result.rows.map((row) => [row.question_key, row]));
  const questions = interviewQuestions.map((question) => ({
    ...question,
    answered: answerMap.has(question.key),
    answer: answerMap.get(question.key) ?? null,
  }));

  const nextQuestion = questions.find((question) => !question.answered) ?? null;

  return {
    questions,
    nextQuestion,
    completed: questions.every((question) => question.answered),
  };
}

export async function saveInterviewAnswer(caseId: string, input: z.infer<typeof answerInterviewSchema>) {
  await assertCaseExists(caseId);

  const question = interviewQuestions.find((candidate) => candidate.key === input.question_key)!;
  const classification = buildClassification(input.question_key, input.answer_text);

  const result = await pool.query(
    `
      INSERT INTO case_interview_answers (
        case_id,
        question_key,
        question_text,
        answer_text,
        summary,
        extracted_user_statement,
        extracted_documented_fact,
        extracted_uncertainty,
        extracted_possible_issue
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (case_id, question_key)
      DO UPDATE SET
        question_text = EXCLUDED.question_text,
        answer_text = EXCLUDED.answer_text,
        summary = EXCLUDED.summary,
        extracted_user_statement = EXCLUDED.extracted_user_statement,
        extracted_documented_fact = EXCLUDED.extracted_documented_fact,
        extracted_uncertainty = EXCLUDED.extracted_uncertainty,
        extracted_possible_issue = EXCLUDED.extracted_possible_issue
      RETURNING
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
    `,
    [
      caseId,
      input.question_key,
      question.text,
      input.answer_text,
      classification.summary,
      classification.extracted_user_statement,
      classification.extracted_documented_fact,
      classification.extracted_uncertainty,
      classification.extracted_possible_issue,
    ],
  );

  return {
    answer: result.rows[0],
    interview: await getInterview(caseId),
  };
}

export function summarizeInterviewAnswers(bundle: CaseBundle) {
  if (!bundle.interviewAnswers.length) {
    return {
      summary: "Saken mangler fortsatt intervjuopplysninger.",
      classifications: [],
    };
  }

  const classifications = bundle.interviewAnswers.map((answer) => ({
    question_key: answer.question_key,
    question_text: answer.question_text,
    summary: answer.summary ?? summarizeText(answer.answer_text),
    extracted_user_statement: answer.extracted_user_statement,
    extracted_documented_fact: answer.extracted_documented_fact,
    extracted_uncertainty: answer.extracted_uncertainty,
    extracted_possible_issue: answer.extracted_possible_issue,
  }));

  const summary = classifications
    .map((item) => `${item.question_text} ${item.summary}`)
    .join(" ")
    .slice(0, 900);

  return {
    summary,
    classifications,
  };
}

export async function generateInterviewSummary(caseId: string) {
  const bundle = await getCaseBundle(caseId);
  return summarizeInterviewAnswers(bundle);
}
