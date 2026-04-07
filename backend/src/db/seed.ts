import { pool } from "./pool";
import { interviewQuestions } from "../lib/domain";

async function seed() {
  const client = await pool.connect();

  try {
    const existingCase = await client.query<{ id: string }>(
      "SELECT id FROM cases WHERE title = $1 LIMIT 1",
      ["Støttemur og terrenginngrep ved boligområde"],
    );

    let caseId = existingCase.rows[0]?.id;

    if (!caseId) {
      const insertedCase = await client.query<{ id: string }>(
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
            ST_SetSRID(ST_MakePoint($5, $6), 4326),
            $7,
            $8,
            $9,
            $10
          )
          RETURNING id
        `,
        [
          "Støttemur og terrenginngrep ved boligområde",
          "Bærum",
          "Gamle Ringeriksvei 14, Bærum",
          "42/117",
          10.4782,
          59.9186,
          "byggesak",
          "under_vurdering",
          "At kommunen revurderer tillatelsen og dokumenterer vurderingsgrunnlaget.",
          "Brukeren mener kommunen kan ha tillatt et terrenginngrep uten tilstrekkelig vurdering av nabokonsekvenser og dokumentasjon.",
        ],
      );

      caseId = insertedCase.rows[0].id;
    }

    const answerRows = await client.query(
      "SELECT question_key FROM case_interview_answers WHERE case_id = $1",
      [caseId],
    );
    const existingQuestionKeys = new Set(answerRows.rows.map((row) => row.question_key));

    const seededAnswers = [
      {
        key: interviewQuestions[0].key,
        text: interviewQuestions[0].text,
        answer:
          "Kommunen ga etter det jeg forstår tillatelse til en støttemur og oppfylling tett på vår tomtegrense. Jeg har sett tegninger og naboarsel, men ikke en tydelig vurdering av høyde og innsyn.",
        summary:
          "Brukeren beskriver et konkret kommunalt vedtak om støttemur og oppfylling nær tomtegrensen.",
        documented:
          "Det finnes tegninger og nabovarsel som dokumenterer at tiltaket har vært behandlet.",
        uncertainty:
          "Det er uklart om kommunen også vurderte terrengvirkning, høyde og naboulemper i vedtaket.",
        issue:
          "Mulig mangelfull saksopplysning og vurdering av nabokonsekvenser.",
      },
      {
        key: interviewQuestions[1].key,
        text: interviewQuestions[1].text,
        answer:
          "Muren virker høyere enn det som var forespeilet, og den gir mer innsyn og avrenning mot vår eiendom. Jeg mener dette er urimelig og kanskje ikke godt nok vurdert opp mot plan- og bygningsregelverket.",
        summary:
          "Brukeren mener tiltaket skaper innsyn, avrenning og uforholdsmessige ulemper.",
        documented:
          "Fotografier og terrengforhold kan underbygge påstanden om høyde og avrenning.",
        uncertainty:
          "Det er ikke fastslått om tiltaket faktisk bryter regelverket.",
        issue:
          "Mulig utilstrekkelig vurdering av ulemper, terreng og nabointeresser.",
      },
      {
        key: interviewQuestions[2].key,
        text: interviewQuestions[2].text,
        answer:
          "Jeg har kommunens vedtak, e-postutveksling, bilder av muren og skjermbilder fra kart. Jeg mangler foreløpig komplette snitt-tegninger og eventuelle interne vurderinger.",
        summary:
          "Brukeren oppgir vedtak, e-post, bilder og kart som dokumentasjon, men mangler enkelte sentrale dokumenter.",
        documented:
          "Kommunalt vedtak, e-post og bilder er konkrete dokumentasjonskilder.",
        uncertainty:
          "Det mangler komplette snitt-tegninger og eventuelle interne vurderinger.",
        issue:
          "Mulig dokumentmangel som svekker kontroll med saksbehandlingen.",
      },
      {
        key: interviewQuestions[3].key,
        text: interviewQuestions[3].text,
        answer:
          "Nabovarselet kom i november 2025. Jeg sendte merknader i desember. Vedtak skal være datert 12. januar 2026. Jeg ba om begrunnelse og innsyn 2. februar 2026, men har bare fått delvis svar.",
        summary:
          "Prosessen omfatter nabovarsel, merknader, vedtak og senere innsynsbegjæring.",
        documented:
          "Det finnes konkrete datoer for nabovarsel, merknader, vedtak og innsynsbegjæring.",
        uncertainty:
          "Det er uklart hvorfor innsynsbegjæringen bare er delvis besvart.",
        issue:
          "Mulig svak oppfølging av merknader og mulig mangelfull håndtering av innsyn.",
      },
      {
        key: interviewQuestions[4].key,
        text: interviewQuestions[4].text,
        answer:
          "Jeg ønsker å få vurdert om vedtaket bør påklages, om mer dokumentasjon bør kreves inn, og hvordan dette kan formuleres saklig overfor kommunen.",
        summary:
          "Brukeren ønsker struktur for klagevurdering, innsyn og videre formell oppfølging.",
        documented:
          "Ønsket utfall er å vurdere klage og innhente mer dokumentasjon.",
        uncertainty:
          "Det er ikke avklart om klage er beste neste steg uten mer dokumentasjon.",
        issue:
          "Behov for klargjøring av prosessvalg mellom klage, innsyn og tilleggsopplysninger.",
      },
    ];

    for (const answer of seededAnswers) {
      if (existingQuestionKeys.has(answer.key)) {
        continue;
      }

      await client.query(
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
        `,
        [
          caseId,
          answer.key,
          answer.text,
          answer.answer,
          answer.summary,
          answer.answer,
          answer.documented,
          answer.uncertainty,
          answer.issue,
        ],
      );
    }

    const evidenceCount = await client.query("SELECT COUNT(*)::int AS count FROM case_evidence WHERE case_id = $1", [caseId]);
    if (evidenceCount.rows[0].count === 0) {
      await client.query(
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
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
            ($1, $11, $12, $13, $14, $15, $16, $17, $18, $19),
            ($1, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        `,
        [
          caseId,
          "Kommunalt vedtak 12.01.2026",
          "dokument",
          "Bærum kommune",
          "https://example.invalid/vedtak",
          "2026-01-12",
          "Vedtak om godkjenning av støttemur og terrengbearbeiding.",
          "Viser hva kommunen faktisk besluttet.",
          "hoy",
          "verifisert",
          "E-post om delvis innsynssvar",
          "lenke",
          "E-postutveksling",
          "https://example.invalid/innsyn",
          "2026-02-08",
          "E-post hvor kommunen bekrefter at deler av dokumentgrunnlaget ikke ble sendt.",
          "Underbygger behovet for videre innsynsbegjæring.",
          "middels",
          "delvis_verifisert",
          "Fotografier av støttemur",
          "dokument",
          "Brukerens egen dokumentasjon",
          null,
          "2026-02-18",
          "Bilder som viser murhøyde, plassering og terrengendring mot nabogrensen.",
          "Underbygger påstanden om faktiske konsekvenser på stedet.",
          "middels",
          "ubekreftet",
        ],
      );
    }

    const sourceCount = await client.query("SELECT COUNT(*)::int AS count FROM case_sources WHERE case_id = $1", [caseId]);
    if (sourceCount.rows[0].count === 0) {
      await client.query(
        `
          INSERT INTO case_sources (
            case_id,
            title,
            publisher,
            source_type,
            source_url,
            publication_date,
            authority_level,
            notes
          )
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8),
            ($1, $9, $10, $11, $12, $13, $14, $15),
            ($1, $16, $17, $18, $19, $20, $21, $22)
        `,
        [
          caseId,
          "Plan- og bygningsloven",
          "Lovdata",
          "lov",
          "https://lovdata.no/dokument/NL/lov/2008-06-27-71",
          null,
          "autoritativ",
          "Relevant for vurdering av byggesaksbehandling og nabohensyn.",
          "Forvaltningsloven",
          "Lovdata",
          "lov",
          "https://lovdata.no/dokument/NL/lov/1967-02-10",
          null,
          "autoritativ",
          "Relevant for begrunnelse, utredning og saksbehandling.",
          "Norgeskart",
          "Kartverket",
          "kartkilde",
          "https://norgeskart.no/",
          null,
          "veiledende",
          "Kan brukes til terreng- og eiendomskontekst.",
        ],
      );
    }

    const timelineCount = await client.query(
      "SELECT COUNT(*)::int AS count FROM case_timeline_events WHERE case_id = $1",
      [caseId],
    );
    if (timelineCount.rows[0].count === 0) {
      await client.query(
        `
          INSERT INTO case_timeline_events (
            case_id,
            event_date,
            title,
            description,
            source_reference,
            certainty_level
          )
          VALUES
            ($1, $2, $3, $4, $5, $6),
            ($1, $7, $8, $9, $10, $11),
            ($1, $12, $13, $14, $15, $16)
        `,
        [
          caseId,
          "2025-11-24",
          "Nabovarsel mottatt",
          "Brukeren mottok nabovarsel om støttemur og terrengtiltak.",
          "Nabovarsel",
          "hoy",
          "2026-01-12",
          "Vedtak fattet",
          "Kommunen fattet vedtak om tiltaket.",
          "Kommunalt vedtak 12.01.2026",
          "hoy",
          "2026-02-02",
          "Innsyn og begrunnelse etterspurt",
          "Brukeren ba om innsyn og nærmere begrunnelse.",
          "E-post om delvis innsynssvar",
          "middels",
        ],
      );
    }

    const observationCount = await client.query(
      "SELECT COUNT(*)::int AS count FROM map_observations WHERE case_id = $1",
      [caseId],
    );
    if (observationCount.rows[0].count === 0) {
      await client.query(
        `
          INSERT INTO map_observations (
            case_id,
            title,
            description,
            geometry_json,
            source_label
          )
          VALUES ($1, $2, $3, $4::jsonb, $5)
        `,
        [
          caseId,
          "Observasjonspunkt ved tomtegrense",
          "Punkt brukt for å markere hvor muren og terrengendringen er mest synlig.",
          JSON.stringify({
            type: "Point",
            coordinates: [10.4782, 59.9186],
          }),
          "Manuell registrering",
        ],
      );
    }

    const analysisCount = await client.query("SELECT COUNT(*)::int AS count FROM case_analysis WHERE case_id = $1", [caseId]);
    if (analysisCount.rows[0].count === 0) {
      await client.query(
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
        `,
        [
          caseId,
          JSON.stringify([
            "Det finnes et kommunalt vedtak datert 12.01.2026.",
            "Brukeren har sendt merknader og senere bedt om begrunnelse og innsyn.",
            "Det finnes bilder, e-post og kartmateriale knyttet til saken.",
          ]),
          JSON.stringify([
            "Det er uklart om kommunen vurderte murhøyde og terrengvirkning tilstrekkelig.",
            "Det er uklart hvilke interne vurderinger som finnes, men ikke er utlevert.",
          ]),
          JSON.stringify([
            "Mulig mangelfull utredning av nabokonsekvenser.",
            "Mulig behov for nærmere vurdering av begrunnelse og dokumentinnsyn.",
          ]),
          JSON.stringify([
            "Fullt tegningsgrunnlag og snitt-tegninger.",
            "Komplett begrunnelse eller saksframlegg for vedtaket.",
          ]),
          JSON.stringify([
            "Be om fullstendig dokumentinnsyn.",
            "Sammenholde vedtak, tegninger og faktiske forhold på stedet.",
            "Vurdere klageutkast når dokumentgrunnlaget er bedre opplyst.",
          ]),
        ],
      );
    }

    const outputCount = await client.query("SELECT COUNT(*)::int AS count FROM case_output WHERE case_id = $1", [caseId]);
    if (outputCount.rows[0].count === 0) {
      await client.query(
        `
          INSERT INTO case_output (case_id, output_type, content)
          VALUES ($1, $2, $3)
        `,
        [
          caseId,
          "kort_sammendrag",
          "Saken gjelder et mulig utilstrekkelig vurdert terrenginngrep og en støttemur nær nabogrense. Dokumentasjonen tyder på at videre innsyn og en mer presis vurdering av saksgrunnlaget bør skje før endelig klage vurderes.",
        ],
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
