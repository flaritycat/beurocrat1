export const caseStatuses = [
  "ny",
  "under_vurdering",
  "mangler_dokumentasjon",
  "klart_for_klage",
  "sendt",
  "avsluttet",
] as const;

export const issueTypes = [
  "saksbehandling",
  "byggesak",
  "plan",
  "miljo",
  "vei_trafikk",
  "eiendom",
  "oppvekst",
  "helse_omsorg",
  "annet",
] as const;

export const evidenceTypes = ["dokument", "fil", "lenke", "notat", "kartobservasjon", "annet"] as const;
export const reliabilityLevels = ["hoy", "middels", "lav"] as const;
export const verificationStatuses = ["ubekreftet", "delvis_verifisert", "verifisert", "bestridt"] as const;
export const sourceTypes = [
  "lov",
  "forskrift",
  "veileder",
  "kommunalt_dokument",
  "offentlig_datasett",
  "kartkilde",
  "brukerreferert_dokument",
] as const;
export const authorityLevels = ["autoritativ", "veiledende", "kontekstuell"] as const;
export const certaintyLevels = ["hoy", "middels", "lav"] as const;
export const outputTypes = [
  "kort_sammendrag",
  "strukturert_saksrapport",
  "bevisliste",
  "mangelliste",
  "full_klage",
  "kort_klage",
  "innsynsbegjaering",
  "ai_promptpakke",
] as const;

export const interviewQuestions = [
  {
    key: "kommunens_handling",
    text: "Hva har kommunen konkret gjort, besluttet, bygget, tillatt, avslått eller unnlatt å gjøre?",
  },
  {
    key: "hvorfor_feil",
    text: "Hvorfor mener du dette er feil, skadelig, urimelig eller ikke i samsvar med regelverk?",
  },
  {
    key: "dokumentasjon",
    text: "Hvilken dokumentasjon eller hvilke bevis har du?",
  },
  {
    key: "prosess_og_tid",
    text: "Hva har skjedd så langt i prosessen, og når?",
  },
  {
    key: "onsket_resultat",
    text: "Hva ønsker du å oppnå nå?",
  },
] as const;

export type OutputType = (typeof outputTypes)[number];

export type Coordinates = {
  lat: number;
  lng: number;
};

export type CaseRecord = {
  id: string;
  title: string;
  municipality: string;
  location_text: string | null;
  gnr_bnr: string | null;
  coordinates: Coordinates | null;
  issue_type: string;
  current_status: string;
  desired_outcome: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type InterviewAnswerRecord = {
  id: string;
  case_id: string;
  question_key: string;
  question_text: string;
  answer_text: string;
  summary: string | null;
  extracted_user_statement: string | null;
  extracted_documented_fact: string | null;
  extracted_uncertainty: string | null;
  extracted_possible_issue: string | null;
  created_at: string;
};

export type EvidenceRecord = {
  id: string;
  case_id: string;
  title: string;
  evidence_type: string;
  source_label: string | null;
  source_url: string | null;
  evidence_date: string | null;
  description: string | null;
  supports_point: string | null;
  reliability_level: string;
  verification_status: string;
  storage_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  created_at: string;
};

export type SourceRecord = {
  id: string;
  case_id: string;
  title: string;
  publisher: string | null;
  source_type: string;
  source_url: string | null;
  publication_date: string | null;
  authority_level: string;
  notes: string | null;
  created_at: string;
};

export type TimelineEventRecord = {
  id: string;
  case_id: string;
  event_date: string;
  title: string;
  description: string | null;
  source_reference: string | null;
  certainty_level: string;
  created_at: string;
};

export type AnalysisRecord = {
  id: string;
  case_id: string;
  known_facts: string[];
  uncertainties: string[];
  possible_issues: string[];
  missing_information: string[];
  recommended_next_steps: string[];
  created_at: string;
  updated_at: string;
};

export type OutputRecord = {
  id: string;
  case_id: string;
  output_type: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type MapObservationRecord = {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  geometry_json: unknown;
  source_label: string | null;
  created_at: string;
};

export type CaseBundle = {
  caseRecord: CaseRecord;
  interviewAnswers: InterviewAnswerRecord[];
  evidence: EvidenceRecord[];
  sources: SourceRecord[];
  timeline: TimelineEventRecord[];
  analysis: AnalysisRecord | null;
  outputs: OutputRecord[];
  mapObservations: MapObservationRecord[];
};
