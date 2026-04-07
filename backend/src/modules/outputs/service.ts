import { z } from "zod";
import { pool } from "../../db/pool";
import { type CaseBundle, type OutputType, outputTypes } from "../../lib/domain";
import { AppError } from "../../lib/http";
import { getCaseBundle } from "../cases/service";
import { summarizeInterviewAnswers } from "../interviews/service";
import { analyzeCase } from "../analysis/service";
import { searchMapContext } from "../maps/service";

function bulletList(items: string[], fallback = "Ingen opplysninger registrert ennå.") {
  if (!items.length) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Ikke oppgitt";
  }

  return value;
}

function buildFacts(bundle: CaseBundle) {
  return bundle.interviewAnswers
    .map((answer) => answer.extracted_documented_fact)
    .filter(Boolean) as string[];
}

function buildUserClaims(bundle: CaseBundle) {
  return bundle.interviewAnswers
    .map((answer) => answer.extracted_user_statement)
    .filter(Boolean) as string[];
}

function buildUncertainties(bundle: CaseBundle) {
  return bundle.interviewAnswers
    .map((answer) => answer.extracted_uncertainty)
    .filter(Boolean) as string[];
}

function buildPossibleIssues(bundle: CaseBundle) {
  return bundle.interviewAnswers
    .map((answer) => answer.extracted_possible_issue)
    .filter(Boolean) as string[];
}

function uniqueLines(items: Array<string | null | undefined>) {
  return [...new Set(items.map((item) => item?.trim()).filter(Boolean) as string[])];
}

function asLowercaseText(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function containsKeywords(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildEvidenceItems(bundle: CaseBundle) {
  return bundle.evidence.map(
    (item) =>
      `| ${item.title} | ${item.evidence_type} | ${item.source_label ?? "Ikke oppgitt"} | ${formatDate(item.evidence_date)} | ${item.supports_point ?? "Ikke oppgitt"} | ${item.verification_status} |`,
  );
}

export function buildEvidenceTable(bundle: CaseBundle) {
  const lines = buildEvidenceItems(bundle);

  if (!lines.length) {
    return "Ingen bevisposter registrert ennå.";
  }

  return [
    "| Tittel | Type | Kilde | Dato | Støtter | Verifisering |",
    "| --- | --- | --- | --- | --- | --- |",
    ...lines,
  ].join("\n");
}

export function buildMissingInfoChecklist(bundle: CaseBundle) {
  const missing = [
    bundle.evidence.length === 0 ? "Registrer minst én konkret bevispost." : null,
    bundle.sources.length === 0 ? "Legg inn relevante kilder og regelgrunnlag." : null,
    bundle.timeline.length === 0 ? "Fyll ut viktige hendelser i tidslinjen." : null,
    bundle.caseRecord.location_text ? null : "Legg til lokasjon for saken." ,
    bundle.mapObservations.length === 0 ? "Vurder å lagre en kartrelatert observasjon." : null,
  ].filter(Boolean) as string[];

  return bulletList(missing, "Ingen åpenbare hull identifisert i MVP-gjennomgangen.");
}

export function summarizeInterviewAnswersOutput(bundle: CaseBundle) {
  const interviewSummary = summarizeInterviewAnswers(bundle);

  return [
    `Saken gjelder ${bundle.caseRecord.title.toLowerCase()} i ${bundle.caseRecord.municipality}.`,
    bundle.caseRecord.summary ?? interviewSummary.summary,
    "Vurderingene under bygger på registrerte data og må kontrolleres opp mot faktiske dokumenter.",
  ].join(" ");
}

export function buildStructuredCase(bundle: CaseBundle) {
  const facts = buildFacts(bundle);
  const claims = buildUserClaims(bundle);
  const uncertainties = buildUncertainties(bundle);
  const issues = buildPossibleIssues(bundle);

  return [
    "# Sakstittel",
    bundle.caseRecord.title,
    "",
    "# Kort sammendrag",
    summarizeInterviewAnswersOutput(bundle),
    "",
    "# Hva kommunen ser ut til å ha gjort eller unnlatt å gjøre",
    bulletList(claims, "Ingen strukturert beskrivelse registrert ennå."),
    "",
    "# Hvorfor dette oppleves som problematisk",
    bulletList(
      bundle.interviewAnswers
        .filter((answer) => answer.question_key === "hvorfor_feil")
        .map((answer) => answer.answer_text),
      "Ikke beskrevet ennå.",
    ),
    "",
    "# Tidslinje",
    bulletList(bundle.timeline.map((item) => `${item.event_date}: ${item.title}. ${item.description ?? ""}`.trim())),
    "",
    "# Dokumentasjon og bevis",
    buildEvidenceTable(bundle),
    "",
    "# Manglende dokumentasjon",
    buildMissingInfoChecklist(bundle),
    "",
    "# Mulige rettslige eller forvaltningsmessige problemstillinger",
    bulletList(issues, "Ingen problemstillinger generert ennå."),
    "",
    "# Svake punkter / usikkerhet",
    bulletList(uncertainties, "Ingen tydelig usikkerhet registrert ennå."),
    "",
    "# Anbefalt neste steg",
    bulletList(
      bundle.analysis?.recommended_next_steps ??
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

export function buildFormalComplaint(bundle: CaseBundle) {
  const facts = buildFacts(bundle);
  const uncertainties = buildUncertainties(bundle);

  return [
    `Til ${bundle.caseRecord.municipality} kommune`,
    "",
    `Emne: Klageutkast i sak om ${bundle.caseRecord.title}`,
    "",
    "Jeg viser til registrerte opplysninger i saken og ber om at kommunen vurderer forholdet på nytt.",
    "",
    "Det følgende er et forsiktig utkast basert på det materialet som per nå er registrert. Jeg ber om at kommunen selv kontrollerer faktum og rettslig grunnlag.",
    "",
    "Forholdet gjelder i hovedsak:",
    bulletList(buildUserClaims(bundle)),
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
      bundle.caseRecord.desired_outcome ?? "hvilket korrigerende tiltak som er mest hensiktsmessig",
    ]),
    "",
    "Jeg ber samtidig om at eventuelle manglende dokumenter og vurderinger gjøres tilgjengelige dersom de finnes i saksgrunnlaget.",
    "",
    "Med hilsen",
    "[Navn settes inn manuelt]",
  ].join("\n");
}

export function buildShortComplaint(bundle: CaseBundle) {
  return [
    `Jeg ber ${bundle.caseRecord.municipality} kommune vurdere saken «${bundle.caseRecord.title}» på nytt.`,
    "Det registrerte materialet tyder på at det kan være behov for en nærmere kontroll av faktum, dokumentgrunnlag og begrunnelse.",
    "Jeg ber særlig om en tydelig redegjørelse for hvilke dokumenter og vurderinger kommunen har bygget på.",
  ].join("\n\n");
}

export function buildInnsynRequest(bundle: CaseBundle) {
  return [
    `Til ${bundle.caseRecord.municipality} kommune`,
    "",
    `Emne: Innsynsbegjæring i sak om ${bundle.caseRecord.title}`,
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

function buildRegisteredSourceLines(bundle: CaseBundle) {
  return bundle.sources.map((item) => {
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

function buildEvidenceCrossCheckLines(bundle: CaseBundle) {
  return bundle.evidence.map((item) => {
    const text = asLowercaseText([
      item.title,
      item.description,
      item.supports_point,
      item.source_label,
      item.source_url,
    ]);
    const controlTracks: string[] = [];

    if (
      bundle.caseRecord.location_text ||
      bundle.caseRecord.gnr_bnr ||
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

function buildInferredDataChecks(bundle: CaseBundle) {
  const combinedText = asLowercaseText([
    bundle.caseRecord.title,
    bundle.caseRecord.location_text,
    bundle.caseRecord.gnr_bnr,
    ...bundle.evidence.flatMap((item) => [item.title, item.description, item.supports_point]),
    ...bundle.mapObservations.flatMap((item) => [item.title, item.description]),
  ]);

  return uniqueLines([
    bundle.caseRecord.location_text || bundle.caseRecord.coordinates || bundle.caseRecord.gnr_bnr
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

async function buildPromptContext(bundle: CaseBundle) {
  const locationQuery =
    bundle.caseRecord.location_text ||
    [bundle.caseRecord.gnr_bnr, bundle.caseRecord.municipality].filter(Boolean).join(" ") ||
    bundle.caseRecord.municipality;

  const mapContext = await searchMapContext(
    locationQuery,
    bundle.caseRecord.municipality,
    bundle.caseRecord.issue_type,
  );
  const firstPlace = mapContext.results.places[0];

  const locationLines = uniqueLines([
    `Kommune: ${bundle.caseRecord.municipality}.`,
    `Registrert lokasjonstekst: ${bundle.caseRecord.location_text}.`,
    bundle.caseRecord.gnr_bnr ? `Registrert gnr/bnr: ${bundle.caseRecord.gnr_bnr}.` : null,
    bundle.caseRecord.coordinates
      ? `Lagrede koordinater: ${bundle.caseRecord.coordinates.lat.toFixed(5)}, ${bundle.caseRecord.coordinates.lng.toFixed(5)}.`
      : null,
    firstPlace
      ? `Det finnes geokodet treff for oppgitt sted. Første treff er «${firstPlace.label}». Treffet må verifiseres mot saken før det brukes som faktum.`
      : bundle.caseRecord.location_text
        ? "Det ble ikke funnet noe sikkert geokodet treff for oppgitt lokasjon i denne sjekken, eller geokoderen var utilgjengelig."
        : "Saken mangler presis lokasjonsangivelse utover kommunenivå.",
    bundle.mapObservations.length
      ? `Det er registrert ${bundle.mapObservations.length} kartobservasjon(er) som kan brukes som stedlig kontekst, men observasjonene må fortsatt vurderes opp mot primærdokumenter.`
      : "Det er ikke registrert egne kartobservasjoner i saken ennå.",
  ]);

  const providerLines = uniqueLines([
    mapContext.providers.geocoder.available
      ? null
      : `Geokoder: ${mapContext.providers.geocoder.message ?? "Kilde utilgjengelig"}.`,
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

  const relevantDataLines = uniqueLines([
    ...buildInferredDataChecks(bundle),
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
    evidenceCrossChecks: buildEvidenceCrossCheckLines(bundle),
  };
}

export async function buildAiPromptPackage(bundle: CaseBundle) {
  const promptContext = await buildPromptContext(bundle);

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
      `Sakstittel: ${bundle.caseRecord.title}`,
      `Kommune: ${bundle.caseRecord.municipality}`,
      `Problemtype: ${bundle.caseRecord.issue_type}`,
      `Status: ${bundle.caseRecord.current_status}`,
      `Lokasjon: ${bundle.caseRecord.location_text ?? "Ikke registrert"}`,
      `Gnr/Bnr: ${bundle.caseRecord.gnr_bnr ?? "Ikke registrert"}`,
      `Ønsket utfall: ${bundle.caseRecord.desired_outcome ?? "Ikke registrert"}`,
      `Kort sammendrag: ${bundle.caseRecord.summary ?? summarizeInterviewAnswersOutput(bundle)}`,
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
    bulletList(buildFacts(bundle)),
    "",
    "# Brukerens påstander",
    bulletList(buildUserClaims(bundle)),
    "",
    "# Registrerte kilder",
    bulletList(buildRegisteredSourceLines(bundle), "Ingen kilder er registrert i saken ennå."),
    "",
    "# Dokumentert bevis",
    bulletList(
      bundle.evidence.map(
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
    bulletList(buildUncertainties(bundle)),
    "",
    "# Mulige problemstillinger",
    bulletList(buildPossibleIssues(bundle)),
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

async function buildOutputContent(bundle: CaseBundle, outputType: OutputType) {
  switch (outputType) {
    case "kort_sammendrag":
      return summarizeInterviewAnswersOutput(bundle);
    case "strukturert_saksrapport":
      return buildStructuredCase(bundle);
    case "bevisliste":
      return buildEvidenceTable(bundle);
    case "mangelliste":
      return buildMissingInfoChecklist(bundle);
    case "full_klage":
      return buildFormalComplaint(bundle);
    case "kort_klage":
      return buildShortComplaint(bundle);
    case "innsynsbegjaering":
      return buildInnsynRequest(bundle);
    case "ai_promptpakke":
      return buildAiPromptPackage(bundle);
    default:
      throw new AppError(400, "OUTPUT_TYPE_NOT_SUPPORTED", "Ukjent output-type");
  }
}

export const generateOutputSchema = z.object({
  output_type: z.enum(outputTypes).default("ai_promptpakke"),
});

export async function generateOutput(caseId: string, outputType: OutputType) {
  await analyzeCase(caseId);
  const bundle = await getCaseBundle(caseId);
  const content = await buildOutputContent(bundle, outputType);

  const result = await pool.query(
    `
      INSERT INTO case_output (
        case_id,
        output_type,
        content
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        case_id,
        output_type,
        content,
        created_at,
        updated_at
    `,
    [caseId, outputType, content],
  );

  const row = result.rows[0];
  return {
    ...row,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listOutputs(caseId: string) {
  const result = await pool.query(
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
  );

  return result.rows.map((row) => ({
    ...row,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  }));
}

export async function getOutput(caseId: string, outputId: string) {
  const result = await pool.query(
    `
      SELECT
        id,
        case_id,
        output_type,
        content,
        created_at,
        updated_at
      FROM case_output
      WHERE case_id = $1 AND id = $2
      LIMIT 1
    `,
    [caseId, outputId],
  );

  if (!result.rowCount) {
    throw new AppError(404, "OUTPUT_NOT_FOUND", "Fant ikke generert output");
  }

  return {
    ...result.rows[0],
    created_at: new Date(String(result.rows[0].created_at)).toISOString(),
    updated_at: new Date(String(result.rows[0].updated_at)).toISOString(),
  };
}
