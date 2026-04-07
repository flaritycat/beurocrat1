import { apiRequest } from "./api";
import {
  interviewQuestions,
  type AnalysisRecord,
  type GeocodeResult,
  type InterviewAnswer,
  type InterviewQuestion,
  type InterviewQuestionKey,
  type InterviewResponse,
  type LocalCaseDraft,
  type MapSearchResponse,
  type OutputRecord,
  type OutputTypeValue,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function uniqueList(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter(Boolean) as string[])];
}

function summarizeText(answerText: string) {
  const compact = answerText.replace(/\s+/g, " ").trim();
  if (compact.length <= 220) {
    return compact;
  }

  return `${compact.slice(0, 217)}...`;
}

function detectDocumentedFact(answerText: string) {
  const indicators = ["vedtak", "brev", "e-post", "bild", "kart", "dokument", "tegning", "dato", "journal"];
  const lower = answerText.toLowerCase();
  const hasIndicator = indicators.some((indicator) => lower.includes(indicator));

  if (!hasIndicator) {
    return "Ikke tydelig dokumentert i svaret alene. Bør knyttes til konkret kilde eller bevispost.";
  }

  return "Svaret viser til konkrete dokumenter, observasjoner eller datoer som kan verifiseres nærmere.";
}

function detectUncertainty(answerText: string) {
  const indicators = ["tror", "mulig", "usikker", "virker", "ser ut til", "etter det jeg forstår", "kanskje"];
  const lower = answerText.toLowerCase();
  const hasIndicator = indicators.some((indicator) => lower.includes(indicator));

  if (!hasIndicator) {
    return "Lite eksplisitt usikkerhet uttrykt i svaret, men faktagrunnlaget bør fortsatt kontrolleres.";
  }

  return "Svaret inneholder forhold som fremstår som foreløpige eller trenger bekreftelse.";
}

function mapPossibleIssue(questionKey: InterviewQuestionKey, answerText: string) {
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

export function classifyInterviewAnswer(questionKey: InterviewQuestionKey, answerText: string) {
  return {
    summary: summarizeText(answerText),
    extracted_user_statement: summarizeText(answerText),
    extracted_documented_fact: detectDocumentedFact(answerText),
    extracted_uncertainty: detectUncertainty(answerText),
    extracted_possible_issue: mapPossibleIssue(questionKey, answerText),
  };
}

export function buildInterviewResponse(answers: InterviewAnswer[]): InterviewResponse {
  const answerMap = new Map(answers.map((answer) => [answer.question_key, answer]));
  const questions: InterviewQuestion[] = interviewQuestions.map((question) => ({
    ...question,
    answered: answerMap.has(question.key),
    answer: answerMap.get(question.key) ?? null,
  }));

  return {
    questions,
    nextQuestion: questions.find((question) => !question.answered) ?? null,
    completed: questions.every((question) => question.answered),
  };
}

export function summarizeInterviewAnswers(draft: LocalCaseDraft) {
  if (!draft.interviewAnswers.length) {
    return {
      summary: "Saken mangler fortsatt intervjuopplysninger.",
      classifications: [],
    };
  }

  const classifications = draft.interviewAnswers.map((answer) => ({
    question_key: answer.question_key,
    question_text: answer.question_text,
    summary: answer.summary ?? summarizeText(answer.answer_text),
    extracted_user_statement: answer.extracted_user_statement,
    extracted_documented_fact: answer.extracted_documented_fact,
    extracted_uncertainty: answer.extracted_uncertainty,
    extracted_possible_issue: answer.extracted_possible_issue,
  }));

  return {
    summary: classifications
      .map((item) => `${item.question_text} ${item.summary}`)
      .join(" ")
      .slice(0, 900),
    classifications,
  };
}

function bulletList(items: string[], fallback = "Ingen opplysninger registrert ennå.") {
  if (!items.length) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatDate(value: string | null) {
  return value || "Ikke oppgitt";
}

function buildFacts(draft: LocalCaseDraft) {
  return draft.interviewAnswers
    .map((answer) => answer.extracted_documented_fact)
    .filter(Boolean) as string[];
}

function buildUserClaims(draft: LocalCaseDraft) {
  return draft.interviewAnswers
    .map((answer) => answer.extracted_user_statement)
    .filter(Boolean) as string[];
}

function buildUncertainties(draft: LocalCaseDraft) {
  return draft.interviewAnswers
    .map((answer) => answer.extracted_uncertainty)
    .filter(Boolean) as string[];
}

function buildPossibleIssues(draft: LocalCaseDraft) {
  return draft.interviewAnswers
    .map((answer) => answer.extracted_possible_issue)
    .filter(Boolean) as string[];
}

function asLowercaseText(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function containsKeywords(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildEvidenceItems(draft: LocalCaseDraft) {
  return draft.evidence.map(
    (item) =>
      `| ${item.title} | ${item.evidence_type} | ${item.source_label ?? "Ikke oppgitt"} | ${formatDate(item.evidence_date)} | ${item.supports_point ?? "Ikke oppgitt"} | ${item.verification_status} |`,
  );
}

export function buildEvidenceTable(draft: LocalCaseDraft) {
  const lines = buildEvidenceItems(draft);

  if (!lines.length) {
    return "Ingen bevisposter registrert ennå.";
  }

  return [
    "| Tittel | Type | Kilde | Dato | Støtter | Verifisering |",
    "| --- | --- | --- | --- | --- | --- |",
    ...lines,
  ].join("\n");
}

export function buildMissingInfoChecklist(draft: LocalCaseDraft) {
  const missing = [
    draft.evidence.length === 0 ? "Registrer minst én konkret bevispost." : null,
    draft.sources.length === 0 ? "Legg inn relevante kilder og regelgrunnlag." : null,
    draft.timeline.length === 0 ? "Fyll ut viktige hendelser i tidslinjen." : null,
    draft.case.location_text ? null : "Legg til lokasjon for saken.",
    draft.mapObservations.length === 0 ? "Vurder å lagre en kartrelatert observasjon." : null,
  ].filter(Boolean) as string[];

  return bulletList(missing, "Ingen åpenbare hull identifisert i denne gjennomgangen.");
}

export function summarizeInterviewAnswersOutput(draft: LocalCaseDraft) {
  const interviewSummary = summarizeInterviewAnswers(draft);

  return [
    `Saken gjelder ${draft.case.title.toLowerCase()} i ${draft.case.municipality}.`,
    draft.case.summary ?? interviewSummary.summary,
    "Vurderingene under bygger på registrerte data og må kontrolleres opp mot faktiske dokumenter.",
  ].join(" ");
}

export function generateAnalysisFromDraft(draft: LocalCaseDraft): AnalysisRecord {
  const generatedAt = nowIso();

  return {
    id: draft.analysis?.id ?? makeId(),
    case_id: draft.case.id,
    known_facts: uniqueList([
      draft.case.summary ?? undefined,
      ...draft.interviewAnswers.map((answer) => answer.extracted_documented_fact ?? undefined),
      ...draft.evidence.map((item) => item.title),
      ...draft.timeline.map((item) => `${item.event_date}: ${item.title}`),
    ]),
    uncertainties: uniqueList([
      ...draft.interviewAnswers.map((answer) => answer.extracted_uncertainty ?? undefined),
      ...draft.mapObservations.map((item) => item.description ?? undefined),
    ]),
    possible_issues: uniqueList([
      ...draft.interviewAnswers.map((answer) => answer.extracted_possible_issue ?? undefined),
      draft.case.issue_type === "byggesak"
        ? "Det kan være grunn til å kontrollere om byggesaksgrunnlaget er tilstrekkelig opplyst."
        : undefined,
      draft.evidence.some((item) => item.verification_status === "ubekreftet")
        ? "Flere bevisposter er fortsatt uverifiserte og bør kontrolleres."
        : undefined,
    ]),
    missing_information: uniqueList([
      draft.interviewAnswers.some((answer) => answer.question_key === "dokumentasjon")
        ? undefined
        : "Det mangler fortsatt svar på dokumentasjonsspørsmålet.",
      draft.sources.length === 0 ? "Relevante kilder og regelgrunnlag er ikke registrert." : undefined,
      draft.timeline.length === 0 ? "Tidslinjen er ikke fylt ut." : undefined,
      draft.evidence.length === 0 ? "Det er ikke registrert konkrete bevisposter." : undefined,
    ]),
    recommended_next_steps: uniqueList([
      "Sammenstill brukerutsagn mot dokumenterte fakta før endelig klageformulering.",
      draft.evidence.some((item) => item.verification_status !== "verifisert")
        ? "Vurder hvilke bevisposter som kan verifiseres ytterligere."
        : undefined,
      draft.sources.length < 2 ? "Registrer flere autoritative kilder for å styrke vurderingsgrunnlaget." : undefined,
      "Vurder innsynsbegjæring dersom sentrale dokumenter mangler.",
    ]),
    created_at: draft.analysis?.created_at ?? generatedAt,
    updated_at: generatedAt,
  };
}

export function buildStructuredCase(draft: LocalCaseDraft) {
  const facts = buildFacts(draft);
  const claims = buildUserClaims(draft);
  const uncertainties = buildUncertainties(draft);
  const issues = buildPossibleIssues(draft);

  return [
    "# Sakstittel",
    draft.case.title,
    "",
    "# Kort sammendrag",
    summarizeInterviewAnswersOutput(draft),
    "",
    "# Hva kommunen ser ut til å ha gjort eller unnlatt å gjøre",
    bulletList(claims, "Ingen strukturert beskrivelse registrert ennå."),
    "",
    "# Hvorfor dette oppleves som problematisk",
    bulletList(
      draft.interviewAnswers
        .filter((answer) => answer.question_key === "hvorfor_feil")
        .map((answer) => answer.answer_text),
      "Ikke beskrevet ennå.",
    ),
    "",
    "# Tidslinje",
    bulletList(draft.timeline.map((item) => `${item.event_date}: ${item.title}. ${item.description ?? ""}`.trim())),
    "",
    "# Dokumentasjon og bevis",
    buildEvidenceTable(draft),
    "",
    "# Manglende dokumentasjon",
    buildMissingInfoChecklist(draft),
    "",
    "# Mulige rettslige eller forvaltningsmessige problemstillinger",
    bulletList(issues, "Ingen problemstillinger generert ennå."),
    "",
    "# Svake punkter / usikkerhet",
    bulletList(uncertainties, "Ingen tydelig usikkerhet registrert ennå."),
    "",
    "# Anbefalt neste steg",
    bulletList(
      draft.analysis?.recommended_next_steps ??
        [
          "Kontroller faktiske dokumenter og datoer mot registrerte utsagn.",
          "Vurder om mer dokumentinnsyn bør kreves før klage formuleres.",
        ],
    ),
    "",
    "# Bekreftede fakta",
    bulletList(facts, "Ingen tydelige dokumenterte fakta registrert ennå."),
  ].join("\n");
}

export function buildFormalComplaint(draft: LocalCaseDraft) {
  const facts = buildFacts(draft);
  const uncertainties = buildUncertainties(draft);

  return [
    `Til ${draft.case.municipality} kommune`,
    "",
    `Emne: Klageutkast i sak om ${draft.case.title}`,
    "",
    "Jeg viser til registrerte opplysninger i saken og ber om at kommunen vurderer forholdet på nytt.",
    "",
    "Det følgende er et forsiktig utkast basert på det materialet som per nå er registrert. Jeg ber om at kommunen selv kontrollerer faktum og rettslig grunnlag.",
    "",
    "Forholdet gjelder i hovedsak:",
    bulletList(buildUserClaims(draft)),
    "",
    "Opplysninger som fremstår som dokumenterte:",
    bulletList(facts, "Dokumentasjonen bør beskrives nærmere før innsending."),
    "",
    "Forhold som fortsatt er uklare:",
    bulletList(uncertainties, "Ingen særskilte usikkerheter er registrert, men dokumentkontroll anbefales."),
    "",
    "På denne bakgrunn ber jeg kommunen vurdere:",
    bulletList([
      "om saken er tilstrekkelig opplyst",
      "om nabo- eller partsinnspill er vurdert på en etterprøvbar måte",
      "om det bør gis en nærmere begrunnelse og eventuelt innsyn i supplerende dokumenter",
      draft.case.desired_outcome ?? "hvilket korrigerende tiltak som er mest hensiktsmessig",
    ]),
    "",
    "Jeg ber samtidig om at eventuelle manglende dokumenter og vurderinger gjøres tilgjengelige dersom de finnes i saksgrunnlaget.",
    "",
    "Med hilsen",
    "[Navn settes inn manuelt]",
  ].join("\n");
}

export function buildShortComplaint(draft: LocalCaseDraft) {
  return [
    `Jeg ber ${draft.case.municipality} kommune vurdere saken «${draft.case.title}» på nytt.`,
    "Det registrerte materialet tyder på at det kan være behov for en nærmere kontroll av faktum, dokumentgrunnlag og begrunnelse.",
    "Jeg ber særlig om en tydelig redegjørelse for hvilke dokumenter og vurderinger kommunen har bygget på.",
  ].join("\n\n");
}

export function buildInnsynRequest(draft: LocalCaseDraft) {
  return [
    `Til ${draft.case.municipality} kommune`,
    "",
    `Emne: Innsynsbegjæring i sak om ${draft.case.title}`,
    "",
    "Jeg ber om innsyn i dokumenter og vurderinger som knytter seg til denne saken, herunder:",
    bulletList([
      "vedtak og saksfremlegg",
      "innkomne merknader og kommunens vurdering av dem",
      "tegninger, kartgrunnlag og eventuelle interne vurderingsnotater",
      "eventuelle dokumenter som belyser stedlige forhold og konsekvenser for naboer",
    ]),
    "",
    "Dersom enkelte dokumenter helt eller delvis unntas, ber jeg om konkret hjemmel og vurdering for unntaket.",
    "",
    "Henvendelsen er formulert som et arbeidsutkast og må tilpasses faktisk sak før utsending.",
  ].join("\n");
}

function buildRegisteredSourceLines(draft: LocalCaseDraft) {
  return draft.sources.map((item) => {
    const parts = [
      item.title,
      item.publisher ? `Utgiver: ${item.publisher}` : null,
      `Type: ${item.source_type}`,
      `Autoritet: ${item.authority_level}`,
      item.source_url ? `Referanse: ${item.source_url}` : null,
      item.notes ? `Merknad: ${item.notes}` : null,
    ].filter(Boolean);

    return parts.join(". ");
  });
}

function buildEvidenceCrossCheckLines(draft: LocalCaseDraft) {
  return draft.evidence.map((item) => {
    const text = asLowercaseText([
      item.title,
      item.description,
      item.supports_point,
      item.source_label,
      item.source_url,
    ]);
    const controlTracks: string[] = [];

    if (
      draft.case.location_text ||
      draft.case.gnr_bnr ||
      containsKeywords(text, ["adresse", "kart", "eiendom", "gnr", "bnr", "tomt", "grense", "plassering"])
    ) {
      controlTracks.push("stedfesting, eiendomsforhold og kartgrunnlag");
    }

    if (
      containsKeywords(text, [
        "vedtak",
        "brev",
        "e-post",
        "epost",
        "merknad",
        "saksbehandling",
        "innsyn",
        "journal",
        "begrunnelse",
        "avslag",
        "tillatelse",
      ])
    ) {
      controlTracks.push("saksdokumenter, journal, vedtak og begrunnelse");
    }

    if (containsKeywords(text, ["terreng", "mur", "bygg", "plan", "avrenning", "regulering", "høyde", "hoyde"])) {
      controlTracks.push("plan-, byggesaks- og terrengrelaterte data");
    }

    if (!controlTracks.length) {
      controlTracks.push("generell kontroll mot primærdokumenter og registrerte kilder");
    }

    return `${item.title}: ${item.supports_point ?? "Støttepunkt er ikke registrert."} Relevante kontrollspor kan være ${controlTracks.join(", ")}.`;
  });
}

function buildInferredDataChecks(draft: LocalCaseDraft) {
  const combinedText = asLowercaseText([
    draft.case.title,
    draft.case.location_text,
    draft.case.gnr_bnr,
    ...draft.evidence.flatMap((item) => [item.title, item.description, item.supports_point]),
    ...draft.mapObservations.flatMap((item) => [item.title, item.description]),
  ]);

  return uniqueList([
    draft.case.location_text || draft.case.coordinates || draft.case.gnr_bnr
      ? "Det kan være relevant å kontrollere sted, eiendomsforhold og avgrensning mot kartgrunnlag og offisielle eiendomsrelaterte kilder."
      : null,
    containsKeywords(combinedText, [
      "vedtak",
      "saksbehandling",
      "begrunnelse",
      "avslag",
      "tillatelse",
      "merknad",
      "saksfremlegg",
    ])
      ? "Det kan være relevant å kontrollere postjournal, saksfremlegg, vedtak, begrunnelse og eventuelle interne vurderinger."
      : null,
    containsKeywords(combinedText, ["innsyn", "offentleglova", "journal", "dokument", "delvis svar"])
      ? "Det kan være relevant å kontrollere om det finnes ytterligere journalposter eller dokumenter som ikke er utlevert."
      : null,
    containsKeywords(combinedText, ["terreng", "mur", "bygg", "regulering", "plan", "avrenning", "høyde", "hoyde"])
      ? "Det kan være relevant å kontrollere planstatus, byggesaksgrunnlag, terrengdata, reguleringsbestemmelser og eventuelle kartlag for høyde eller avrenning."
      : null,
    containsKeywords(combinedText, ["miljø", "miljo", "støy", "stoy", "vei", "trafikk"])
      ? "Det kan være relevant å kontrollere miljø-, støy-, trafikk- eller veirelaterte datakilder dersom slike forhold er en del av saken."
      : null,
  ]);
}

function fallbackMapContext(): MapSearchResponse {
  return {
    tiles: {
      key: "fallback",
      urlTemplate: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "Kartdata © OpenStreetMap-bidragsytere",
    },
    providers: {
      geocoder: { key: "osm-nominatim", enabled: true, available: false, message: "Kilde utilgjengelig" },
      publicDatasets: { key: "datasets", enabled: true, available: false, message: "Kilde utilgjengelig" },
      legalSources: { key: "legal", enabled: true, available: false, message: "Kilde utilgjengelig" },
      municipalitySources: { key: "municipality", enabled: true, available: false, message: "Kilde utilgjengelig" },
    },
    results: {
      places: [],
      datasets: [],
      legalSources: [],
      municipalitySources: [],
    },
  };
}

async function fetchMapContext(draft: LocalCaseDraft) {
  const locationQuery =
    draft.case.location_text ||
    [draft.case.gnr_bnr, draft.case.municipality].filter(Boolean).join(" ") ||
    draft.case.municipality;

  try {
    return await apiRequest<MapSearchResponse>(
      `/maps/search?query=${encodeURIComponent(locationQuery)}&municipality=${encodeURIComponent(draft.case.municipality)}&issueType=${encodeURIComponent(draft.case.issue_type)}`,
    );
  } catch {
    return fallbackMapContext();
  }
}

async function buildPromptContext(draft: LocalCaseDraft) {
  const mapContext = await fetchMapContext(draft);
  const firstPlace = mapContext.results.places[0] as GeocodeResult | undefined;

  const locationLines = uniqueList([
    `Kommune: ${draft.case.municipality}.`,
    `Registrert lokasjonstekst: ${draft.case.location_text ?? "Ikke registrert"}.`,
    draft.case.gnr_bnr ? `Registrert gnr/bnr: ${draft.case.gnr_bnr}.` : null,
    draft.case.coordinates
      ? `Lagrede koordinater: ${draft.case.coordinates.lat.toFixed(5)}, ${draft.case.coordinates.lng.toFixed(5)}.`
      : null,
    firstPlace
      ? `Det finnes geokodet treff for oppgitt sted. Første treff er «${firstPlace.label}». Treffet må verifiseres mot saken før det brukes som faktum.`
      : draft.case.location_text
        ? "Det ble ikke funnet noe sikkert geokodet treff for oppgitt lokasjon i denne sjekken, eller geokoderen var utilgjengelig."
        : "Saken mangler presis lokasjonsangivelse utover kommunenivå.",
    draft.mapObservations.length
      ? `Det er registrert ${draft.mapObservations.length} kartobservasjon(er) som kan brukes som stedlig kontekst, men observasjonene må fortsatt vurderes opp mot primærdokumenter.`
      : "Det er ikke registrert egne kartobservasjoner i saken ennå.",
  ]);

  const providerLines = uniqueList([
    mapContext.providers.geocoder.available ? null : `Geokoder: ${mapContext.providers.geocoder.message ?? "Kilde utilgjengelig"}.`,
    mapContext.providers.publicDatasets.available
      ? null
      : `Offentlige datasett: ${mapContext.providers.publicDatasets.message ?? "Kilde utilgjengelig"}.`,
    mapContext.providers.legalSources.available
      ? null
      : `Juridiske kilder: ${mapContext.providers.legalSources.message ?? "Kilde utilgjengelig"}.`,
    mapContext.providers.municipalitySources.available
      ? null
      : `Kommunale kildespor: ${mapContext.providers.municipalitySources.message ?? "Kilde utilgjengelig"}.`,
  ]);

  const relevantDataLines = uniqueList([
    ...buildInferredDataChecks(draft),
    ...mapContext.results.datasets.slice(0, 3).map((item) => {
      return `${item.title} (${item.publisher}). ${item.notes ?? "Relevans må vurderes konkret."} Referanse: ${item.source_url}`;
    }),
    ...mapContext.results.legalSources.slice(0, 3).map((item) => {
      return `${item.title} (${item.publisher}). ${item.notes ?? "Kan være relevant for rettslig vurdering."} Referanse: ${item.source_url}`;
    }),
    ...mapContext.results.municipalitySources.slice(0, 2).map((item) => {
      return `${item.title} (${item.publisher}). ${item.notes ?? "Kan gi spor til kommunale dokumenter eller innsyn."} Referanse: ${item.source_url}`;
    }),
  ]);

  return {
    locationLines,
    providerLines,
    relevantDataLines,
    evidenceCrossChecks: buildEvidenceCrossCheckLines(draft),
  };
}

export async function buildAiPromptPackage(draft: LocalCaseDraft) {
  const promptContext = await buildPromptContext(draft);

  return [
    "# Rolle",
    "Du er en faglig, nøktern analyseassistent som skal levere en profesjonell vurdering på norsk bokmål.",
    "",
    "# Oppgave",
    "Analyser materialet med høy forsiktighet. Skill tydelig mellom dokumenterte forhold, brukerens beskrivelser, usikkerhet og mulige oppfølgingsspor. Ikke presenter antakelser som etablerte fakta.",
    "",
    "# Stilkrav",
    bulletList([
      "Ingen emojis.",
      "Ingen uformelle formuleringer, utrop eller retoriske overdrivelser.",
      "Profesjonell, saklig og etterprøvbar tone.",
      "Tydelig markering av hva som er bekreftet, hva som bare er opplyst av bruker, og hva som er uklart.",
      "Ingen bastante konklusjoner om lovbrudd uten klart grunnlag i kilder og dokumentasjon.",
    ]),
    "",
    "# Saksidentifikasjon",
    bulletList([
      `Sakstittel: ${draft.case.title}`,
      `Kommune: ${draft.case.municipality}`,
      `Problemtype: ${draft.case.issue_type}`,
      `Status: ${draft.case.current_status}`,
      `Lokasjon: ${draft.case.location_text ?? "Ikke registrert"}`,
      `Gnr/Bnr: ${draft.case.gnr_bnr ?? "Ikke registrert"}`,
      `Ønsket utfall: ${draft.case.desired_outcome ?? "Ikke registrert"}`,
      `Kort sammendrag: ${draft.case.summary ?? summarizeInterviewAnswersOutput(draft)}`,
    ]),
    "",
    "# Adresse, kart og stedskontekst",
    bulletList(promptContext.locationLines),
    "",
    "# Kildestatus",
    bulletList(
      promptContext.providerLines.length
        ? promptContext.providerLines
        : ["Tilgjengelige kildespor svarte uten å indikere utilgjengelighet i denne kontrollen."],
    ),
    "",
    "# Bekreftede fakta",
    bulletList(buildFacts(draft)),
    "",
    "# Brukerens påstander",
    bulletList(buildUserClaims(draft)),
    "",
    "# Registrerte kilder",
    bulletList(buildRegisteredSourceLines(draft), "Ingen kilder er registrert i saken ennå."),
    "",
    "# Dokumentert bevis",
    bulletList(
      draft.evidence.map(
        (item) =>
          `${item.title} (${item.evidence_type}, ${item.source_label ?? "ukjent kilde"}, verifisering: ${item.verification_status}, dato: ${formatDate(item.evidence_date)})${item.supports_point ? ` Støtter: ${item.supports_point}.` : ""}`,
      ),
      "Ingen bevisposter er registrert ennå.",
    ),
    "",
    "# Relevante data- og kontrollspor",
    bulletList(
      promptContext.relevantDataLines,
      "Ingen supplerende data- eller kontrollspor ble identifisert i denne automatiske gjennomgangen.",
    ),
    "",
    "# Kryssjekk mellom bevis og kontrollspor",
    bulletList(
      promptContext.evidenceCrossChecks,
      "Det finnes ingen registrerte bevisposter å knytte mot kontrollspor ennå.",
    ),
    "",
    "# Usikkerhet",
    bulletList(buildUncertainties(draft)),
    "",
    "# Mulige problemstillinger",
    bulletList(buildPossibleIssues(draft)),
    "",
    "# Hva som ikke må antas",
    bulletList([
      "At kommunen har begått lovbrudd uten at dokumentasjonen klart viser det.",
      "At brukerens opplevelse alene er tilstrekkelig bevis for faktiske forhold.",
      "At manglende dokumenter nødvendigvis betyr feil hos kommunen.",
    ]),
    "",
    "# Ønsket output",
    bulletList([
      "Oppsummer først hva som fremstår som dokumentert.",
      "Beskriv deretter brukerens påstander separat.",
      "Forklar hva som er uklart og hvilke kontrollspor som virker mest relevante videre.",
      "Vurder hvilke dokumenter, kartdata eller kommunale opplysninger som bør undersøkes nærmere.",
      "Skisser et saklig og profesjonelt grunnlag for videre klage, innsyn eller annen formell oppfølging.",
    ]),
    "",
    "# Krav til kildebruk",
    bulletList([
      "Skille tydelig mellom dokumenterte fakta, brukerutsagn og usikkerhet.",
      "Vis hvilke punkter som krever kildekontroll før de brukes i formelle brev.",
      "Oppgi når et kontrollspor bare er et mulig videre undersøkelsesspor.",
      "Vis tilbake til registrerte bevis, kilder, kartopplysninger og tidslinje der det er relevant.",
      "Dersom opplysninger mangler eller kilder er utilgjengelige, skal det sies eksplisitt.",
    ]),
  ].join("\n");
}

async function buildOutputContent(draft: LocalCaseDraft, outputType: OutputTypeValue) {
  switch (outputType) {
    case "kort_sammendrag":
      return summarizeInterviewAnswersOutput(draft);
    case "strukturert_saksrapport":
      return buildStructuredCase(draft);
    case "bevisliste":
      return buildEvidenceTable(draft);
    case "mangelliste":
      return buildMissingInfoChecklist(draft);
    case "full_klage":
      return buildFormalComplaint(draft);
    case "kort_klage":
      return buildShortComplaint(draft);
    case "innsynsbegjaering":
      return buildInnsynRequest(draft);
    case "ai_promptpakke":
      return buildAiPromptPackage(draft);
  }
}

export async function generateOutputFromDraft(draft: LocalCaseDraft, outputType: OutputTypeValue) {
  const analysis = generateAnalysisFromDraft(draft);
  const content = await buildOutputContent({ ...draft, analysis }, outputType);
  const generatedAt = nowIso();
  const output: OutputRecord = {
    id: makeId(),
    case_id: draft.case.id,
    output_type: outputType,
    content,
    created_at: generatedAt,
    updated_at: generatedAt,
  };

  return { analysis, output };
}
