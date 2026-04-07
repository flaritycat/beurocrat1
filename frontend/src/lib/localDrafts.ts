import {
  interviewQuestions,
  type AnalysisRecord,
  type CaseRecord,
  type DraftExportEnvelope,
  type EvidenceRecord,
  type InterviewAnswer,
  type InterviewQuestionKey,
  type LocalCaseDraft,
  type MapObservation,
  type OutputRecord,
  type SourceRecord,
  type TimelineEvent,
} from "./types";
import { classifyInterviewAnswer } from "./workspaceLogic";

const storageKey = "kommune.local_drafts.v1";

type PersistedDraftState = {
  drafts: LocalCaseDraft[];
};

type CreateDraftInput = {
  title: string;
  municipality: string;
  issue_type: string;
  current_status: string;
  desired_outcome: string;
  summary: string;
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function defaultState(): PersistedDraftState {
  return { drafts: [] };
}

function readState() {
  if (typeof window === "undefined") {
    return defaultState();
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDraftState>;
    return {
      drafts: Array.isArray(parsed.drafts)
        ? parsed.drafts.map((draft) => normalizeDraft(draft)).filter(Boolean) as LocalCaseDraft[]
        : [],
    };
  } catch {
    return defaultState();
  }
}

function writeState(state: PersistedDraftState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function validString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeCoordinates(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawLat = (value as Record<string, unknown>).lat;
  const rawLng = (value as Record<string, unknown>).lng;
  if (typeof rawLat !== "number" || typeof rawLng !== "number") {
    return null;
  }

  return { lat: rawLat, lng: rawLng };
}

function touchCase(caseRecord: CaseRecord) {
  return {
    ...caseRecord,
    updated_at: nowIso(),
  };
}

function normalizeCaseRecord(value: unknown): CaseRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const createdAt = validString(raw.created_at, nowIso());
  const updatedAt = validString(raw.updated_at, createdAt);

  return {
    id: validString(raw.id, makeId()),
    title: validString(raw.title, "Utkast uten tittel"),
    municipality: validString(raw.municipality, ""),
    location_text: nullableString(raw.location_text),
    gnr_bnr: nullableString(raw.gnr_bnr),
    coordinates: normalizeCoordinates(raw.coordinates),
    issue_type: validString(raw.issue_type, "annet"),
    current_status: validString(raw.current_status, "ny"),
    desired_outcome: nullableString(raw.desired_outcome),
    summary: nullableString(raw.summary),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeInterviewAnswer(value: unknown, caseId: string): InterviewAnswer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const questionKey = validString(raw.question_key);
  const question = interviewQuestions.find((item) => item.key === questionKey);
  if (!question) {
    return null;
  }

  return {
    id: validString(raw.id, makeId()),
    case_id: caseId,
    question_key: question.key,
    question_text: validString(raw.question_text, question.text),
    answer_text: validString(raw.answer_text),
    summary: nullableString(raw.summary),
    extracted_user_statement: nullableString(raw.extracted_user_statement),
    extracted_documented_fact: nullableString(raw.extracted_documented_fact),
    extracted_uncertainty: nullableString(raw.extracted_uncertainty),
    extracted_possible_issue: nullableString(raw.extracted_possible_issue),
    created_at: validString(raw.created_at, nowIso()),
  };
}

function normalizeEvidence(value: unknown, caseId: string): EvidenceRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    id: validString(raw.id, makeId()),
    case_id: caseId,
    title: validString(raw.title, "Bevispost"),
    evidence_type: validString(raw.evidence_type, "dokument"),
    source_label: nullableString(raw.source_label),
    source_url: nullableString(raw.source_url),
    evidence_date: nullableString(raw.evidence_date),
    description: nullableString(raw.description),
    supports_point: nullableString(raw.supports_point),
    reliability_level: validString(raw.reliability_level, "middels"),
    verification_status: validString(raw.verification_status, "ubekreftet"),
    storage_path: null,
    file_name: null,
    mime_type: null,
    file_size_bytes: null,
    created_at: validString(raw.created_at, nowIso()),
  };
}

function normalizeSource(value: unknown, caseId: string): SourceRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    id: validString(raw.id, makeId()),
    case_id: caseId,
    title: validString(raw.title, "Kilde"),
    publisher: nullableString(raw.publisher),
    source_type: validString(raw.source_type, "lov"),
    source_url: nullableString(raw.source_url),
    publication_date: nullableString(raw.publication_date),
    authority_level: validString(raw.authority_level, "kontekstuell"),
    notes: nullableString(raw.notes),
    created_at: validString(raw.created_at, nowIso()),
  };
}

function normalizeTimelineEvent(value: unknown, caseId: string): TimelineEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    id: validString(raw.id, makeId()),
    case_id: caseId,
    event_date: validString(raw.event_date),
    title: validString(raw.title, "Hendelse"),
    description: nullableString(raw.description),
    source_reference: nullableString(raw.source_reference),
    certainty_level: validString(raw.certainty_level, "middels"),
    created_at: validString(raw.created_at, nowIso()),
  };
}

function normalizeAnalysis(value: unknown, caseId: string): AnalysisRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    id: validString(raw.id, makeId()),
    case_id: caseId,
    known_facts: Array.isArray(raw.known_facts) ? raw.known_facts.map((item) => validString(item)).filter(Boolean) : [],
    uncertainties: Array.isArray(raw.uncertainties) ? raw.uncertainties.map((item) => validString(item)).filter(Boolean) : [],
    possible_issues: Array.isArray(raw.possible_issues) ? raw.possible_issues.map((item) => validString(item)).filter(Boolean) : [],
    missing_information: Array.isArray(raw.missing_information)
      ? raw.missing_information.map((item) => validString(item)).filter(Boolean)
      : [],
    recommended_next_steps: Array.isArray(raw.recommended_next_steps)
      ? raw.recommended_next_steps.map((item) => validString(item)).filter(Boolean)
      : [],
    created_at: validString(raw.created_at, nowIso()),
    updated_at: validString(raw.updated_at, nowIso()),
  };
}

function normalizeOutput(value: unknown, caseId: string): OutputRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    id: validString(raw.id, makeId()),
    case_id: caseId,
    output_type: validString(raw.output_type, "ai_promptpakke"),
    content: validString(raw.content),
    created_at: validString(raw.created_at, nowIso()),
    updated_at: validString(raw.updated_at, nowIso()),
  };
}

function normalizeMapObservation(value: unknown, caseId: string): MapObservation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const geometry = raw.geometry_json;
  if (!geometry || typeof geometry !== "object") {
    return null;
  }

  return {
    id: validString(raw.id, makeId()),
    case_id: caseId,
    title: validString(raw.title, "Kartobservasjon"),
    description: nullableString(raw.description),
    geometry_json: geometry as GeoJSON.Geometry,
    source_label: nullableString(raw.source_label),
    created_at: validString(raw.created_at, nowIso()),
  };
}

function normalizeDraft(value: unknown): LocalCaseDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const caseRecord = normalizeCaseRecord(raw.case);
  if (!caseRecord) {
    return null;
  }

  const caseId = caseRecord.id;

  return {
    case: caseRecord,
    interviewAnswers: Array.isArray(raw.interviewAnswers)
      ? raw.interviewAnswers.map((item) => normalizeInterviewAnswer(item, caseId)).filter(Boolean) as InterviewAnswer[]
      : [],
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence.map((item) => normalizeEvidence(item, caseId)).filter(Boolean) as EvidenceRecord[]
      : [],
    sources: Array.isArray(raw.sources)
      ? raw.sources.map((item) => normalizeSource(item, caseId)).filter(Boolean) as SourceRecord[]
      : [],
    timeline: Array.isArray(raw.timeline)
      ? raw.timeline.map((item) => normalizeTimelineEvent(item, caseId)).filter(Boolean) as TimelineEvent[]
      : [],
    analysis: normalizeAnalysis(raw.analysis, caseId),
    outputs: Array.isArray(raw.outputs)
      ? raw.outputs.map((item) => normalizeOutput(item, caseId)).filter(Boolean) as OutputRecord[]
      : [],
    mapObservations: Array.isArray(raw.mapObservations)
      ? raw.mapObservations.map((item) => normalizeMapObservation(item, caseId)).filter(Boolean) as MapObservation[]
      : [],
  };
}

function replaceDraft(updatedDraft: LocalCaseDraft) {
  const state = readState();
  const nextDrafts = state.drafts.some((draft) => draft.case.id === updatedDraft.case.id)
    ? state.drafts.map((draft) => (draft.case.id === updatedDraft.case.id ? updatedDraft : draft))
    : [updatedDraft, ...state.drafts];

  writeState({ drafts: nextDrafts });
  return updatedDraft;
}

export function listLocalDrafts() {
  return readState().drafts.sort((left, right) => right.case.updated_at.localeCompare(left.case.updated_at));
}

export function listLocalCaseRecords() {
  return listLocalDrafts().map((draft) => draft.case);
}

export function getLocalDraft(caseId: string) {
  return readState().drafts.find((draft) => draft.case.id === caseId) ?? null;
}

export function createLocalDraft(input: CreateDraftInput) {
  const createdAt = nowIso();
  const caseId = makeId();
  const draft: LocalCaseDraft = {
    case: {
      id: caseId,
      title: input.title.trim(),
      municipality: input.municipality.trim(),
      location_text: null,
      gnr_bnr: null,
      coordinates: null,
      issue_type: input.issue_type,
      current_status: input.current_status,
      desired_outcome: input.desired_outcome.trim() || null,
      summary: input.summary.trim() || null,
      created_at: createdAt,
      updated_at: createdAt,
    },
    interviewAnswers: [],
    evidence: [],
    sources: [],
    timeline: [],
    analysis: null,
    outputs: [],
    mapObservations: [],
  };

  return replaceDraft(draft);
}

export function saveLocalDraft(draft: LocalCaseDraft) {
  return replaceDraft({
    ...draft,
    case: touchCase(draft.case),
  });
}

export function updateLocalCase(
  draft: LocalCaseDraft,
  patch: Partial<Omit<CaseRecord, "id" | "created_at" | "updated_at">>,
) {
  return saveLocalDraft({
    ...draft,
    case: {
      ...draft.case,
      ...patch,
    },
  });
}

export function saveInterviewAnswerToDraft(draft: LocalCaseDraft, questionKey: InterviewQuestionKey, answerText: string) {
  const question = interviewQuestions.find((item) => item.key === questionKey);
  if (!question) {
    throw new Error("Ukjent intervjuspørsmål");
  }

  const classification = classifyInterviewAnswer(questionKey, answerText);
  const existing = draft.interviewAnswers.find((answer) => answer.question_key === questionKey);
  const answer: InterviewAnswer = {
    id: existing?.id ?? makeId(),
    case_id: draft.case.id,
    question_key: questionKey,
    question_text: question.text,
    answer_text: answerText,
    summary: classification.summary,
    extracted_user_statement: classification.extracted_user_statement,
    extracted_documented_fact: classification.extracted_documented_fact,
    extracted_uncertainty: classification.extracted_uncertainty,
    extracted_possible_issue: classification.extracted_possible_issue,
    created_at: existing?.created_at ?? nowIso(),
  };

  return saveLocalDraft({
    ...draft,
    interviewAnswers: [
      ...draft.interviewAnswers.filter((item) => item.question_key !== questionKey),
      answer,
    ].sort((left, right) => {
      return (
        interviewQuestions.findIndex((item) => item.key === left.question_key) -
        interviewQuestions.findIndex((item) => item.key === right.question_key)
      );
    }),
  });
}

export function addEvidenceToDraft(draft: LocalCaseDraft, input: Omit<EvidenceRecord, "id" | "case_id" | "created_at">) {
  const evidence: EvidenceRecord = {
    ...input,
    id: makeId(),
    case_id: draft.case.id,
    created_at: nowIso(),
  };

  return saveLocalDraft({
    ...draft,
    evidence: [evidence, ...draft.evidence],
  });
}

export function addSourceToDraft(draft: LocalCaseDraft, input: Omit<SourceRecord, "id" | "case_id" | "created_at">) {
  const source: SourceRecord = {
    ...input,
    id: makeId(),
    case_id: draft.case.id,
    created_at: nowIso(),
  };

  return saveLocalDraft({
    ...draft,
    sources: [source, ...draft.sources],
  });
}

export function addTimelineEventToDraft(draft: LocalCaseDraft, input: Omit<TimelineEvent, "id" | "case_id" | "created_at">) {
  const event: TimelineEvent = {
    ...input,
    id: makeId(),
    case_id: draft.case.id,
    created_at: nowIso(),
  };

  return saveLocalDraft({
    ...draft,
    timeline: [...draft.timeline, event].sort((left, right) => left.event_date.localeCompare(right.event_date)),
  });
}

export function addMapObservationToDraft(
  draft: LocalCaseDraft,
  input: Omit<MapObservation, "id" | "case_id" | "created_at">,
) {
  const observation: MapObservation = {
    ...input,
    id: makeId(),
    case_id: draft.case.id,
    created_at: nowIso(),
  };

  const evidence: EvidenceRecord = {
    id: makeId(),
    case_id: draft.case.id,
    title: input.title,
    evidence_type: "kartobservasjon",
    source_label: input.source_label ?? "Kart og lokasjon",
    source_url: null,
    evidence_date: null,
    description: input.description ?? "Kartrelatert observasjon lagret lokalt i utkastet.",
    supports_point: "Stedlig kontekst og observasjon på kart.",
    reliability_level: "middels",
    verification_status: "ubekreftet",
    storage_path: null,
    file_name: null,
    mime_type: null,
    file_size_bytes: null,
    created_at: observation.created_at,
  };

  return saveLocalDraft({
    ...draft,
    mapObservations: [observation, ...draft.mapObservations],
    evidence: [evidence, ...draft.evidence],
  });
}

export function saveAnalysisToDraft(draft: LocalCaseDraft, analysis: AnalysisRecord) {
  return saveLocalDraft({
    ...draft,
    analysis,
  });
}

export function addOutputToDraft(draft: LocalCaseDraft, analysis: AnalysisRecord, output: OutputRecord) {
  return saveLocalDraft({
    ...draft,
    analysis,
    outputs: [output, ...draft.outputs],
  });
}

export function buildDraftExportJson(draft: LocalCaseDraft) {
  const envelope: DraftExportEnvelope = {
    schema_version: 1,
    exported_at: nowIso(),
    draft,
  };

  return JSON.stringify(envelope, null, 2);
}

function cloneImportedDraft(draft: LocalCaseDraft) {
  const caseId = makeId();
  const importedAt = nowIso();

  return {
    case: {
      ...draft.case,
      id: caseId,
      created_at: importedAt,
      updated_at: importedAt,
    },
    interviewAnswers: draft.interviewAnswers.map((item) => ({
      ...item,
      id: makeId(),
      case_id: caseId,
      created_at: importedAt,
    })),
    evidence: draft.evidence.map((item) => ({
      ...item,
      id: makeId(),
      case_id: caseId,
      created_at: importedAt,
    })),
    sources: draft.sources.map((item) => ({
      ...item,
      id: makeId(),
      case_id: caseId,
      created_at: importedAt,
    })),
    timeline: draft.timeline.map((item) => ({
      ...item,
      id: makeId(),
      case_id: caseId,
      created_at: importedAt,
    })),
    analysis: draft.analysis
      ? {
          ...draft.analysis,
          id: makeId(),
          case_id: caseId,
          created_at: importedAt,
          updated_at: importedAt,
        }
      : null,
    outputs: draft.outputs.map((item) => ({
      ...item,
      id: makeId(),
      case_id: caseId,
      created_at: importedAt,
      updated_at: importedAt,
    })),
    mapObservations: draft.mapObservations.map((item) => ({
      ...item,
      id: makeId(),
      case_id: caseId,
      created_at: importedAt,
    })),
  } satisfies LocalCaseDraft;
}

export function importDraftFromJson(rawText: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Kunne ikke lese JSON. Lim inn en gyldig eksportert sakspakke.");
  }

  const candidate =
    parsed && typeof parsed === "object" && "draft" in (parsed as Record<string, unknown>)
      ? (parsed as Record<string, unknown>).draft
      : parsed;

  const normalized = normalizeDraft(candidate);
  if (!normalized) {
    throw new Error("Innholdet ser ikke ut som en gyldig eksportert sakspakke.");
  }

  return replaceDraft(cloneImportedDraft(normalized));
}

export function removeLocalDraft(caseId: string) {
  const state = readState();
  writeState({
    drafts: state.drafts.filter((draft) => draft.case.id !== caseId),
  });
}
