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

export type CaseDetailsResponse = {
  case: CaseRecord;
  counts: Record<string, string>;
};

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

export type InterviewQuestionKey = (typeof interviewQuestions)[number]["key"];

export type InterviewAnswer = {
  id: string;
  case_id: string;
  question_key: InterviewQuestionKey;
  question_text: string;
  answer_text: string;
  summary: string | null;
  extracted_user_statement: string | null;
  extracted_documented_fact: string | null;
  extracted_uncertainty: string | null;
  extracted_possible_issue: string | null;
  created_at: string;
};

export type InterviewQuestion = {
  key: InterviewQuestionKey;
  text: string;
  answered: boolean;
  answer: InterviewAnswer | null;
};

export type InterviewResponse = {
  questions: InterviewQuestion[];
  nextQuestion: InterviewQuestion | null;
  completed: boolean;
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

export type TimelineEvent = {
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

export type MapObservation = {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  geometry_json: GeoJSON.Geometry;
  source_label: string | null;
  created_at: string;
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  municipality?: string;
  county?: string;
  source: string;
};

export type ProviderStatus = {
  key: string;
  enabled: boolean;
  available: boolean;
  message?: string;
};

export type SourceSuggestion = {
  title: string;
  publisher: string;
  source_type: string;
  source_url: string;
  authority_level: string;
  notes?: string;
};

export type TileConfig = {
  key: string;
  urlTemplate: string;
  attribution: string;
};

export type MapSearchResponse = {
  tiles: TileConfig;
  providers: {
    geocoder: ProviderStatus;
    publicDatasets: ProviderStatus;
    legalSources: ProviderStatus;
    municipalitySources: ProviderStatus;
  };
  results: {
    places: GeocodeResult[];
    datasets: SourceSuggestion[];
    legalSources: SourceSuggestion[];
    municipalitySources: SourceSuggestion[];
  };
};

export type LocalCaseDraft = {
  case: CaseRecord;
  interviewAnswers: InterviewAnswer[];
  evidence: EvidenceRecord[];
  sources: SourceRecord[];
  timeline: TimelineEvent[];
  analysis: AnalysisRecord | null;
  outputs: OutputRecord[];
  mapObservations: MapObservation[];
};

export type DraftExportEnvelope = {
  schema_version: 1;
  exported_at: string;
  draft: LocalCaseDraft;
};

export const caseStatusOptions = [
  "ny",
  "under_vurdering",
  "mangler_dokumentasjon",
  "klart_for_klage",
  "sendt",
  "avsluttet",
];

export const issueTypeOptions = [
  "saksbehandling",
  "byggesak",
  "plan",
  "miljo",
  "vei_trafikk",
  "eiendom",
  "oppvekst",
  "helse_omsorg",
  "annet",
];

export const evidenceTypeOptions = ["dokument", "lenke", "notat", "kartobservasjon", "annet"];
export const verificationStatusOptions = ["ubekreftet", "delvis_verifisert", "verifisert", "bestridt"];
export const reliabilityLevelOptions = ["hoy", "middels", "lav"];
export const sourceTypeOptions = [
  "lov",
  "forskrift",
  "veileder",
  "kommunalt_dokument",
  "offentlig_datasett",
  "kartkilde",
  "brukerreferert_dokument",
];
export const authorityLevelOptions = ["autoritativ", "veiledende", "kontekstuell"];
export const certaintyLevelOptions = ["hoy", "middels", "lav"];
export const outputTypeOptions = [
  ["ai_promptpakke", "AI-promptpakke (standard)"],
  ["kort_sammendrag", "Kort sammendrag"],
  ["strukturert_saksrapport", "Strukturert saksrapport"],
  ["bevisliste", "Bevisliste"],
  ["mangelliste", "Mangelliste"],
  ["full_klage", "Full klage"],
  ["kort_klage", "Kort klage"],
  ["innsynsbegjaering", "Innsynsbegjæring"],
] as const;

export type OutputTypeValue = (typeof outputTypeOptions)[number][0];
