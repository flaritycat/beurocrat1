import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicNotice } from "../../components/PublicNotice";
import { StatusBadge } from "../../components/StatusBadge";
import { createLocalDraft, importDraftFromJson, listLocalCaseRecords } from "../../lib/localDrafts";
import { caseStatusOptions, issueTypeOptions, type CaseRecord } from "../../lib/types";

const processSteps = [
  {
    title: "1. Opprett lokalt utkast",
    description: "Registrer saken med kort tittel, kommune og et nøkternt sammendrag. Utkastet lagres bare i denne nettleseren.",
  },
  {
    title: "2. Besvar spørsmålene",
    description: "Arbeid deg gjennom de 5 kjernespørsmålene slik at faktum, usikkerhet og mulige problemstillinger skilles.",
  },
  {
    title: "3. Legg inn bevis og kilder",
    description: "Registrer manuelle bevisposter, lenker, notater, tidslinje og relevante kilder som kan kontrolleres senere.",
  },
  {
    title: "4. Knytt saken til sted",
    description: "Bruk adresse, kart og observasjoner for å bygge stedlig kontekst og finne relevante datakilder.",
  },
  {
    title: "5. Generer analyse og prompt",
    description: "Bygg analyse, klageutkast og AI-promptpakke direkte fra det lokale utkastet.",
  },
  {
    title: "6. Eksporter eksplisitt",
    description: "Kopier prompt, tekst eller JSON-utkast når du selv vil ta det videre til en annen enhet eller ekstern AI.",
  },
] as const;

const initialCaseForm = {
  title: "",
  municipality: "",
  issue_type: "annet",
  current_status: "ny",
  desired_outcome: "",
  summary: "",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [form, setForm] = useState(initialCaseForm);
  const [submitting, setSubmitting] = useState(false);
  const [importText, setImportText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    setCases(listLocalCaseRecords().slice(0, 6));
  }, []);

  function refreshLocalCases() {
    setCases(listLocalCaseRecords().slice(0, 6));
  }

  function handleCreateCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const created = createLocalDraft(form);
      navigate(`/cases/${created.case.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Kunne ikke opprette lokalt utkast");
      setSubmitting(false);
    }
  }

  function handleImportCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportError(null);

    try {
      const imported = importDraftFromJson(importText);
      setImportText("");
      refreshLocalCases();
      navigate(`/cases/${imported.case.id}`);
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : "Kunne ikke importere utkast");
    }
  }

  return (
    <div className="page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Arbeidsflate</p>
          <h1>Undersøk kommunesaker uten serverlagret saksdatabase.</h1>
          <p className="lead">
            Verktøyet er bygget som en lokal prompt- og strukturbygger. Utkast lagres i denne nettleseren, ikke som en
            offentlig saksliste på serveren.
          </p>
        </div>

        <div className="hero-card__signals">
          <div className="signal-card">
            <h3>Lokal lagring</h3>
            <p>Arbeidet blir liggende på denne enheten til du selv eksporterer det videre.</p>
          </div>
          <div className="signal-card">
            <h3>Sporbar output</h3>
            <p>Genererte tekster bygges fra saksdata og kan kontrolleres punkt for punkt før de brukes videre.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Slik fungerer det</p>
            <h2>Arbeidsflyt</h2>
          </div>
        </div>

        <div className="process-grid">
          {processSteps.map((step) => (
            <article className="process-step" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>

        <div className="process-note">
          <h3>Om AI-promptpakken</h3>
          <p>
            Det du registrerer i saken kan brukes til å bygge en strukturert AI-promptpakke. Den kan kopieres og
            limes inn i eksterne tjenester som ChatGPT, Claude eller andre verktøy.
          </p>
          <p>
            Løsningen sender ikke saken automatisk videre til slike tjenester. Hvis du selv limer inn promptpakken i
            en ekstern AI-tjeneste, er det du som velger å dele innholdet.
          </p>
          <p>
            Dokumenter, bilder og andre vedlegg skal fortsatt ikke lastes opp her. Slike vedlegg må håndteres utenfor
            denne løsningen dersom du senere velger å bruke dem i ekstern AI.
          </p>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nytt lokalt utkast</p>
              <h2>Opprett utkast</h2>
            </div>
          </div>

          <PublicNotice />

          <form className="stack" onSubmit={handleCreateCase}>
            <label className="field">
              <span>Sakstittel</span>
              <input
                required
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Kommune</span>
              <input
                required
                value={form.municipality}
                onChange={(event) => setForm((current) => ({ ...current, municipality: event.target.value }))}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Type problem</span>
                <select
                  value={form.issue_type}
                  onChange={(event) => setForm((current) => ({ ...current, issue_type: event.target.value }))}
                >
                  {issueTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select
                  value={form.current_status}
                  onChange={(event) => setForm((current) => ({ ...current, current_status: event.target.value }))}
                >
                  {caseStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Ønsket utfall</span>
              <textarea
                rows={3}
                value={form.desired_outcome}
                onChange={(event) => setForm((current) => ({ ...current, desired_outcome: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Kort sammendrag</span>
              <textarea
                rows={4}
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Oppretter..." : "Opprett lokalt utkast"}
            </button>
          </form>
        </section>

        <section className="stack">
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Lokale utkast</p>
                <h2>Nylige utkast</h2>
              </div>
              <Link className="ghost-button" to="/cases">
                Åpne alle
              </Link>
            </div>

            {cases.length === 0 ? <p>Ingen lokale utkast registrert ennå.</p> : null}

            <div className="stack">
              {cases.map((caseRecord) => (
                <Link className="list-card" key={caseRecord.id} to={`/cases/${caseRecord.id}`}>
                  <div className="list-card__meta">
                    <strong>{caseRecord.title}</strong>
                    <span>{caseRecord.municipality}</span>
                  </div>
                  <div className="list-card__badges">
                    <StatusBadge>{caseRecord.current_status}</StatusBadge>
                    <StatusBadge tone="fact">{caseRecord.issue_type}</StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Import</p>
                <h2>Lim inn eksportert JSON</h2>
              </div>
            </div>

            <form className="stack" onSubmit={handleImportCase}>
              <label className="field">
                <span>Sakspakke (JSON)</span>
                <textarea
                  rows={10}
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder='Lim inn tidligere eksportert JSON fra et lokalt utkast'
                />
              </label>
              {importError ? <p className="error-text">{importError}</p> : null}
              <button className="primary-button" type="submit">
                Importer utkast
              </button>
            </form>
          </section>
        </section>
      </div>
    </div>
  );
}
