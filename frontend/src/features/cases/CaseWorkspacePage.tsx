import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CopyBlock } from "../../components/CopyBlock";
import { PublicNotice } from "../../components/PublicNotice";
import { StatusBadge } from "../../components/StatusBadge";
import {
  addEvidenceToDraft,
  addMapObservationToDraft,
  addOutputToDraft,
  addSourceToDraft,
  addTimelineEventToDraft,
  buildDraftExportJson,
  getLocalDraft,
  removeLocalDraft,
  saveAnalysisToDraft,
  saveInterviewAnswerToDraft,
  updateLocalCase,
} from "../../lib/localDrafts";
import { apiRequest } from "../../lib/api";
import {
  authorityLevelOptions,
  caseStatusOptions,
  certaintyLevelOptions,
  evidenceTypeOptions,
  issueTypeOptions,
  outputTypeOptions,
  reliabilityLevelOptions,
  sourceTypeOptions,
  verificationStatusOptions,
  type AnalysisRecord,
  type GeocodeResult,
  type LocalCaseDraft,
  type MapSearchResponse,
  type OutputRecord,
  type OutputTypeValue,
} from "../../lib/types";
import { buildInterviewResponse, generateAnalysisFromDraft, generateOutputFromDraft } from "../../lib/workspaceLogic";
import { CaseMap } from "./CaseMap";

type WorkspaceTab =
  | "oversikt"
  | "intervju"
  | "bevis"
  | "kilder"
  | "tidslinje"
  | "kart"
  | "analyse"
  | "output";

const tabs: Array<{ key: WorkspaceTab; label: string }> = [
  { key: "oversikt", label: "Oversikt" },
  { key: "intervju", label: "Intervju" },
  { key: "bevis", label: "Bevis" },
  { key: "kilder", label: "Kilder" },
  { key: "tidslinje", label: "Tidslinje" },
  { key: "kart", label: "Kart" },
  { key: "analyse", label: "Analyse" },
  { key: "output", label: "Output" },
];

const initialOverviewForm = {
  title: "",
  municipality: "",
  location_text: "",
  gnr_bnr: "",
  issue_type: "annet",
  current_status: "ny",
  desired_outcome: "",
  summary: "",
};

export function CaseWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("oversikt");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<LocalCaseDraft | null>(null);
  const [mapSearch, setMapSearch] = useState<MapSearchResponse | null>(null);
  const [selectedGeocodeResult, setSelectedGeocodeResult] = useState<GeocodeResult | null>(null);
  const [overviewForm, setOverviewForm] = useState(initialOverviewForm);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [currentOutputType, setCurrentOutputType] = useState<OutputTypeValue>("ai_promptpakke");

  useEffect(() => {
    if (!id) {
      return;
    }

    void loadWorkspace(id);
  }, [id]);

  async function fetchInitialMapContext(nextDraft: LocalCaseDraft) {
    try {
      const data = await apiRequest<MapSearchResponse>(
        `/maps/search?municipality=${encodeURIComponent(nextDraft.case.municipality)}&issueType=${encodeURIComponent(nextDraft.case.issue_type)}`,
      );
      setMapSearch(data);
    } catch {
      setMapSearch(null);
    }
  }

  async function loadWorkspace(caseId: string) {
    setLoading(true);
    setError(null);

    const localDraft = getLocalDraft(caseId);
    if (!localDraft) {
      setError("Utkastet finnes ikke i denne nettleseren. Importer en sakspakke eller opprett et nytt utkast.");
      setLoading(false);
      return;
    }

    setDraft(localDraft);
    setOverviewForm({
      title: localDraft.case.title,
      municipality: localDraft.case.municipality,
      location_text: localDraft.case.location_text ?? "",
      gnr_bnr: localDraft.case.gnr_bnr ?? "",
      issue_type: localDraft.case.issue_type,
      current_status: localDraft.case.current_status,
      desired_outcome: localDraft.case.desired_outcome ?? "",
      summary: localDraft.case.summary ?? "",
    });
    setSelectedOutputId(
      localDraft.outputs.find((item) => item.output_type === "ai_promptpakke")?.id ?? localDraft.outputs[0]?.id ?? null,
    );
    await fetchInitialMapContext(localDraft);
    setLoading(false);
  }

  function applyDraft(nextDraft: LocalCaseDraft) {
    setDraft(nextDraft);
    setOverviewForm({
      title: nextDraft.case.title,
      municipality: nextDraft.case.municipality,
      location_text: nextDraft.case.location_text ?? "",
      gnr_bnr: nextDraft.case.gnr_bnr ?? "",
      issue_type: nextDraft.case.issue_type,
      current_status: nextDraft.case.current_status,
      desired_outcome: nextDraft.case.desired_outcome ?? "",
      summary: nextDraft.case.summary ?? "",
    });
  }

  function handleOverviewSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const updated = updateLocalCase(draft, {
      ...overviewForm,
      location_text: overviewForm.location_text || null,
      gnr_bnr: overviewForm.gnr_bnr || null,
      desired_outcome: overviewForm.desired_outcome || null,
      summary: overviewForm.summary || null,
    });
    applyDraft(updated);
    void fetchInitialMapContext(updated);
  }

  function handleInterviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const interview = buildInterviewResponse(draft.interviewAnswers);
    if (!interview.nextQuestion) {
      return;
    }

    const updated = saveInterviewAnswerToDraft(draft, interview.nextQuestion.key, interviewAnswer);
    setInterviewAnswer("");
    applyDraft(updated);
  }

  function handleEvidenceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const updated = addEvidenceToDraft(draft, {
      title: String(payload.title),
      evidence_type: String(payload.evidence_type),
      source_label: String(payload.source_label || "") || null,
      source_url: String(payload.source_url || "") || null,
      evidence_date: String(payload.evidence_date || "") || null,
      description: String(payload.description || "") || null,
      supports_point: String(payload.supports_point || "") || null,
      reliability_level: String(payload.reliability_level || "middels"),
      verification_status: String(payload.verification_status || "ubekreftet"),
      storage_path: null,
      file_name: null,
      mime_type: null,
      file_size_bytes: null,
    });

    event.currentTarget.reset();
    applyDraft(updated);
  }

  function handleSourceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const updated = addSourceToDraft(draft, {
      title: String(payload.title),
      publisher: String(payload.publisher || "") || null,
      source_type: String(payload.source_type),
      source_url: String(payload.source_url || "") || null,
      publication_date: String(payload.publication_date || "") || null,
      authority_level: String(payload.authority_level || "autoritativ"),
      notes: String(payload.notes || "") || null,
    });

    event.currentTarget.reset();
    applyDraft(updated);
  }

  function handleTimelineSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const updated = addTimelineEventToDraft(draft, {
      event_date: String(payload.event_date),
      title: String(payload.title),
      description: String(payload.description || "") || null,
      source_reference: String(payload.source_reference || "") || null,
      certainty_level: String(payload.certainty_level || "middels"),
    });

    event.currentTarget.reset();
    applyDraft(updated);
  }

  async function handleMapSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const data = await apiRequest<MapSearchResponse>(
      `/maps/search?query=${encodeURIComponent(mapQuery)}&municipality=${encodeURIComponent(draft.case.municipality)}&issueType=${encodeURIComponent(draft.case.issue_type)}`,
    );
    setMapSearch(data);
  }

  function handleUseGeocodeResult(result: GeocodeResult) {
    if (!draft) {
      return;
    }

    const updated = updateLocalCase(draft, {
      location_text: result.label,
      coordinates: {
        lat: result.lat,
        lng: result.lng,
      },
    });

    setSelectedGeocodeResult(result);
    applyDraft(updated);
  }

  function handleMapObservationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.case.coordinates) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const updated = addMapObservationToDraft(draft, {
      title: String(payload.title),
      description: String(payload.description || "") || null,
      source_label: String(payload.source_label || "Kartnotat"),
      geometry_json: {
        type: "Point",
        coordinates: [draft.case.coordinates.lng, draft.case.coordinates.lat],
      },
    });

    event.currentTarget.reset();
    applyDraft(updated);
  }

  function handleAnalyze() {
    if (!draft) {
      return;
    }

    const analysis = generateAnalysisFromDraft(draft);
    const updated = saveAnalysisToDraft(draft, analysis);
    applyDraft(updated);
  }

  async function handleGenerateOutput() {
    if (!draft) {
      return;
    }

    const generated = await generateOutputFromDraft(draft, currentOutputType);
    const updated = addOutputToDraft(draft, generated.analysis, generated.output);
    setSelectedOutputId(generated.output.id);
    applyDraft(updated);
  }

  function handleDeleteDraft() {
    if (!draft) {
      return;
    }

    const confirmed = window.confirm("Slette dette lokale utkastet fra nettleseren?");
    if (!confirmed) {
      return;
    }

    removeLocalDraft(draft.case.id);
    navigate("/cases");
  }

  if (loading) {
    return (
      <div className="page">
        <p>Laster lokalt utkast...</p>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page">
        <section className="card stack">
          <h1>Kunne ikke åpne utkast</h1>
          <p>{error ?? "Ukjent feil."}</p>
          <Link className="ghost-button" to="/">
            Til dashboard
          </Link>
        </section>
      </div>
    );
  }

  const interview = buildInterviewResponse(draft.interviewAnswers);
  const analysis = draft.analysis;
  const selectedOutput =
    draft.outputs.find((item) => item.id === selectedOutputId) ??
    draft.outputs.find((item) => item.output_type === "ai_promptpakke") ??
    draft.outputs[0] ??
    null;
  const exportPayload = buildDraftExportJson(draft);

  return (
    <div className="workspace">
      <aside className="workspace__sidebar card">
        <p className="eyebrow">Lokal saksarbeidsflate</p>
        <h1>{draft.case.title}</h1>
        <p>{draft.case.municipality}</p>
        <div className="stack stack--tight">
          <StatusBadge>{draft.case.current_status}</StatusBadge>
          <StatusBadge tone="fact">{draft.case.issue_type}</StatusBadge>
        </div>
        <PublicNotice compact />
        <button className="ghost-button" onClick={handleDeleteDraft} type="button">
          Slett lokalt utkast
        </button>
        <nav className="workspace-nav">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.key ? "workspace-nav__button is-active" : "workspace-nav__button"}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace__content stack">
        <PublicNotice />

        {activeTab === "oversikt" ? (
          <section className="card stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Oversikt</p>
                <h2>Saksdata</h2>
              </div>
            </div>

            <div className="process-note">
              <h3>Lokal lagring og eksport</h3>
              <p>
                Dette utkastet lagres bare i nettleseren på denne enheten. Hvis du vil ta det med videre til en annen
                enhet eller beholde en kopi, må du eksportere det eksplisitt i Output-fanen.
              </p>
            </div>

            <form className="stack" onSubmit={handleOverviewSave}>
              <div className="form-grid">
                <label className="field">
                  <span>Sakstittel</span>
                  <input
                    value={overviewForm.title}
                    onChange={(event) => setOverviewForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Kommune</span>
                  <input
                    value={overviewForm.municipality}
                    onChange={(event) =>
                      setOverviewForm((current) => ({ ...current, municipality: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Lokasjon</span>
                  <input
                    value={overviewForm.location_text}
                    onChange={(event) =>
                      setOverviewForm((current) => ({ ...current, location_text: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Gnr/Bnr</span>
                  <input
                    value={overviewForm.gnr_bnr}
                    onChange={(event) => setOverviewForm((current) => ({ ...current, gnr_bnr: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Type problem</span>
                  <select
                    value={overviewForm.issue_type}
                    onChange={(event) =>
                      setOverviewForm((current) => ({ ...current, issue_type: event.target.value }))
                    }
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
                    value={overviewForm.current_status}
                    onChange={(event) =>
                      setOverviewForm((current) => ({ ...current, current_status: event.target.value }))
                    }
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
                  value={overviewForm.desired_outcome}
                  onChange={(event) =>
                    setOverviewForm((current) => ({ ...current, desired_outcome: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span>Kort sammendrag</span>
                <textarea
                  rows={5}
                  value={overviewForm.summary}
                  onChange={(event) => setOverviewForm((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>

              <button className="primary-button" type="submit">
                Lagre oversikt lokalt
              </button>
            </form>
          </section>
        ) : null}

        {activeTab === "intervju" ? (
          <>
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Intervju</p>
                  <h2>De 5 kjernespørsmålene</h2>
                </div>
                <StatusBadge tone={interview.completed ? "fact" : "warning"}>
                  {interview.completed ? "Fullført" : "Pågår"}
                </StatusBadge>
              </div>

              {interview.nextQuestion ? (
                <form className="stack" onSubmit={handleInterviewSubmit}>
                  <div className="question-card">
                    <span className="question-card__step">
                      Spørsmål {interview.questions.findIndex((question) => question.key === interview.nextQuestion?.key) + 1} av 5
                    </span>
                    <h3>{interview.nextQuestion.text}</h3>
                  </div>
                  <label className="field">
                    <span>Svar</span>
                    <textarea
                      required
                      rows={8}
                      value={interviewAnswer}
                      onChange={(event) => setInterviewAnswer(event.target.value)}
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Lagre svar lokalt
                  </button>
                </form>
              ) : (
                <p>Alle 5 spørsmål er besvart. Du kan fortsatt gå gjennom klassifiseringen under.</p>
              )}
            </section>

            <section className="stack">
              {interview.questions
                .filter((question) => question.answer)
                .map((question) => (
                  <article className="card" key={question.key}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">{question.text}</p>
                        <h3>{question.answer?.summary ?? "Strukturert svar"}</h3>
                      </div>
                    </div>
                    <div className="evidence-grid">
                      <div className="note-box note-box--fact">
                        <h4>Brukerutsagn</h4>
                        <p>{question.answer?.extracted_user_statement}</p>
                      </div>
                      <div className="note-box note-box--fact">
                        <h4>Dokumentert fakta</h4>
                        <p>{question.answer?.extracted_documented_fact}</p>
                      </div>
                      <div className="note-box note-box--warning">
                        <h4>Usikkerhet</h4>
                        <p>{question.answer?.extracted_uncertainty}</p>
                      </div>
                      <div className="note-box note-box--missing">
                        <h4>Mulig problemstilling</h4>
                        <p>{question.answer?.extracted_possible_issue}</p>
                      </div>
                    </div>
                  </article>
                ))}
            </section>
          </>
        ) : null}

        {activeTab === "bevis" ? (
          <>
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Dokumentasjon og bevis</p>
                  <h2>Registrer bevispost</h2>
                </div>
              </div>

              <div className="process-note">
                <h3>Manuell registrering</h3>
                <p>
                  Denne løsningen tar ikke imot dokumenter, bilder eller andre vedlegg. Registrer i stedet en nøktern
                  beskrivelse, lenke, referanse eller notat om hva materialet viser.
                </p>
                <p>
                  Dersom du senere vil bruke vedlegg i en ekstern AI-tjeneste, må du selv ta dem med utenfor denne
                  arbeidsflaten.
                </p>
              </div>

              <form className="stack" onSubmit={handleEvidenceSubmit}>
                <div className="form-grid">
                  <label className="field">
                    <span>Tittel</span>
                    <input name="title" required />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <select name="evidence_type" defaultValue="dokument">
                      {evidenceTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Kilde</span>
                    <input name="source_label" />
                  </label>
                  <label className="field">
                    <span>URL</span>
                    <input name="source_url" type="url" />
                  </label>
                  <label className="field">
                    <span>Dato</span>
                    <input name="evidence_date" type="date" />
                  </label>
                  <label className="field">
                    <span>Pålitelighet</span>
                    <select name="reliability_level" defaultValue="middels">
                      {reliabilityLevelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Verifisering</span>
                    <select name="verification_status" defaultValue="ubekreftet">
                      {verificationStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Beskrivelse</span>
                  <textarea name="description" rows={4} />
                </label>
                <label className="field">
                  <span>Hva den støtter</span>
                  <textarea name="supports_point" rows={3} />
                </label>
                <button className="primary-button" type="submit">
                  Lagre bevispost lokalt
                </button>
              </form>
            </section>

            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Bevistabell</p>
                  <h2>Registrerte poster</h2>
                </div>
              </div>
              <div className="table-list">
                {draft.evidence.map((item) => (
                  <article className="table-list__row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description ?? "Ingen beskrivelse registrert."}</p>
                      {item.source_url ? (
                        <a href={item.source_url} rel="noreferrer" target="_blank">
                          Åpne kilde
                        </a>
                      ) : null}
                    </div>
                    <div className="table-list__meta">
                      <StatusBadge tone="fact">{item.evidence_type}</StatusBadge>
                      <StatusBadge>{item.verification_status}</StatusBadge>
                      <span>{item.evidence_date ?? "Uten dato"}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {activeTab === "kilder" ? (
          <>
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Kilder og regelgrunnlag</p>
                  <h2>Registrer kilde</h2>
                </div>
              </div>

              <form className="stack" onSubmit={handleSourceSubmit}>
                <div className="form-grid">
                  <label className="field">
                    <span>Tittel</span>
                    <input name="title" required />
                  </label>
                  <label className="field">
                    <span>Utgiver</span>
                    <input name="publisher" />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <select name="source_type" defaultValue="lov">
                      {sourceTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>URL eller referanse</span>
                    <input name="source_url" type="url" />
                  </label>
                  <label className="field">
                    <span>Dato</span>
                    <input name="publication_date" type="date" />
                  </label>
                  <label className="field">
                    <span>Autoritetsnivå</span>
                    <select name="authority_level" defaultValue="autoritativ">
                      {authorityLevelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Merknad</span>
                  <textarea name="notes" rows={4} />
                </label>
                <button className="primary-button" type="submit">
                  Lagre kilde lokalt
                </button>
              </form>
            </section>

            <section className="stack">
              {draft.sources.map((item) => (
                <article className="card" key={item.id}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{item.publisher ?? "Ukjent utgiver"}</p>
                      <h3>{item.title}</h3>
                    </div>
                    <div className="stack stack--tight">
                      <StatusBadge tone="fact">{item.source_type}</StatusBadge>
                      <StatusBadge>{item.authority_level}</StatusBadge>
                    </div>
                  </div>
                  <p>{item.notes ?? "Ingen merknad registrert."}</p>
                  {item.source_url ? (
                    <a href={item.source_url} rel="noreferrer" target="_blank">
                      Åpne referanse
                    </a>
                  ) : null}
                </article>
              ))}
            </section>
          </>
        ) : null}

        {activeTab === "tidslinje" ? (
          <>
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Tidslinje</p>
                  <h2>Legg til hendelse</h2>
                </div>
              </div>
              <form className="stack" onSubmit={handleTimelineSubmit}>
                <div className="form-grid">
                  <label className="field">
                    <span>Dato</span>
                    <input name="event_date" required type="date" />
                  </label>
                  <label className="field">
                    <span>Tittel</span>
                    <input name="title" required />
                  </label>
                  <label className="field">
                    <span>Kildehenvisning</span>
                    <input name="source_reference" />
                  </label>
                  <label className="field">
                    <span>Sikkerhet</span>
                    <select name="certainty_level" defaultValue="middels">
                      {certaintyLevelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Beskrivelse</span>
                  <textarea name="description" rows={4} />
                </label>
                <button className="primary-button" type="submit">
                  Lagre hendelse lokalt
                </button>
              </form>
            </section>

            <section className="stack">
              {draft.timeline.map((item) => (
                <article className="card" key={item.id}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{item.event_date}</p>
                      <h3>{item.title}</h3>
                    </div>
                    <StatusBadge>{item.certainty_level}</StatusBadge>
                  </div>
                  <p>{item.description ?? "Ingen beskrivelse registrert."}</p>
                  {item.source_reference ? <p>Kilde: {item.source_reference}</p> : null}
                </article>
              ))}
            </section>
          </>
        ) : null}

        {activeTab === "kart" ? (
          <>
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Kart og lokasjon</p>
                  <h2>Lokasjonskontekst</h2>
                </div>
              </div>

              <form className="search-bar" onSubmit={handleMapSearch}>
                <input
                  placeholder="Søk adresse eller sted"
                  value={mapQuery}
                  onChange={(event) => setMapQuery(event.target.value)}
                />
                <button className="primary-button" type="submit">
                  Søk
                </button>
              </form>

              {mapSearch?.providers.geocoder.available === false ? (
                <p className="error-text">{mapSearch.providers.geocoder.message ?? "Kilde utilgjengelig"}</p>
              ) : null}

              <div className="map-layout">
                <CaseMap
                  coordinates={draft.case.coordinates}
                  observations={draft.mapObservations}
                  selectedResult={selectedGeocodeResult}
                  tileConfig={mapSearch?.tiles ?? null}
                />

                <div className="stack">
                  <section className="card card--nested">
                    <h3>Søketreff</h3>
                    <div className="stack stack--tight">
                      {mapSearch?.results.places.length ? null : <p>Ingen søketreff ennå.</p>}
                      {mapSearch?.results.places.map((place) => (
                        <button
                          className="result-card"
                          key={`${place.lat}-${place.lng}-${place.label}`}
                          onClick={() => handleUseGeocodeResult(place)}
                          type="button"
                        >
                          <strong>{place.label}</strong>
                          <span>
                            {place.municipality ?? "Ukjent kommune"} {place.county ? `· ${place.county}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="card card--nested">
                    <h3>Lokasjonsnotat</h3>
                    {draft.case.coordinates ? (
                      <form className="stack" onSubmit={handleMapObservationSubmit}>
                        <label className="field">
                          <span>Tittel</span>
                          <input name="title" required />
                        </label>
                        <label className="field">
                          <span>Beskrivelse</span>
                          <textarea name="description" rows={4} />
                        </label>
                        <label className="field">
                          <span>Kilde</span>
                          <input name="source_label" />
                        </label>
                        <button className="primary-button" type="submit">
                          Lagre observasjon lokalt
                        </button>
                      </form>
                    ) : (
                      <p>Velg eller lagre først en sakslokasjon for å opprette kartobservasjon.</p>
                    )}
                  </section>
                </div>
              </div>
            </section>

            <section className="context-grid">
              <article className="card">
                <h3>Offentlige datasett</h3>
                <div className="stack stack--tight">
                  {mapSearch?.results.datasets.map((item) => (
                    <a className="source-suggestion" href={item.source_url} key={item.title} rel="noreferrer" target="_blank">
                      <strong>{item.title}</strong>
                      <span>{item.notes}</span>
                    </a>
                  ))}
                </div>
              </article>
              <article className="card">
                <h3>Juridiske kildespor</h3>
                <div className="stack stack--tight">
                  {mapSearch?.results.legalSources.map((item) => (
                    <a className="source-suggestion" href={item.source_url} key={item.title} rel="noreferrer" target="_blank">
                      <strong>{item.title}</strong>
                      <span>{item.notes}</span>
                    </a>
                  ))}
                </div>
              </article>
              <article className="card">
                <h3>Kommunale kildespor</h3>
                <div className="stack stack--tight">
                  {mapSearch?.results.municipalitySources.map((item) => (
                    <a className="source-suggestion" href={item.source_url} key={item.title} rel="noreferrer" target="_blank">
                      <strong>{item.title}</strong>
                      <span>{item.notes}</span>
                    </a>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : null}

        {activeTab === "analyse" ? (
          <>
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Analyse og problemstillinger</p>
                  <h2>Strukturert vurdering</h2>
                </div>
                <button className="primary-button" onClick={handleAnalyze} type="button">
                  Generer analyse lokalt
                </button>
              </div>
              <p>Formuleringene er bevisst forsiktige og skal ikke leses som en juridisk fasit.</p>
            </section>

            {analysis ? (
              <div className="analysis-grid">
                <article className="card">
                  <h3>Hva vi vet</h3>
                  <ul>
                    {analysis.known_facts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="card">
                  <h3>Hva som er uklart</h3>
                  <ul>
                    {analysis.uncertainties.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="card">
                  <h3>Hva som kan være problematisk</h3>
                  <ul>
                    {analysis.possible_issues.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="card">
                  <h3>Hva som mangler</h3>
                  <ul>
                    {analysis.missing_information.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="card">
                  <h3>Anbefalt neste steg</h3>
                  <ul>
                    {analysis.recommended_next_steps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            ) : (
              <section className="card">
                <p>Ingen analyse generert ennå.</p>
              </section>
            )}
          </>
        ) : null}

        {activeTab === "output" ? (
          <>
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Output og eksport</p>
                  <h2>Generer tekster</h2>
                </div>
              </div>
              <div className="process-note">
                <h3>Hva denne outputen brukes til</h3>
                <p>
                  Outputene bygges av det du har lagt inn i saken. AI-promptpakken er laget for å kunne kopieres og
                  brukes videre i eksterne AI-verktøy som ChatGPT, Claude eller tilsvarende tjenester.
                </p>
                <p>
                  Løsningen sender ikke saken automatisk til slike tjenester. Hvis du kopierer og limer inn innhold i
                  en ekstern AI-tjeneste, er det du som velger å dele det videre.
                </p>
                <p>
                  Vedlegg, bilder og dokumentfiler følger ikke med fra denne løsningen. Hvis du vil bruke slike filer
                  i en ekstern AI-tjeneste, må du selv legge dem ved der.
                </p>
              </div>
              <div className="output-toolbar">
                <select value={currentOutputType} onChange={(event) => setCurrentOutputType(event.target.value as OutputTypeValue)}>
                  {outputTypeOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button className="primary-button" onClick={handleGenerateOutput} type="button">
                  Generer lokalt
                </button>
              </div>
            </section>

            <section className="output-layout">
              <aside className="card output-list">
                <h3>Genererte dokumenter</h3>
                <div className="stack stack--tight">
                  {draft.outputs.map((item) => (
                    <button
                      className={selectedOutputId === item.id ? "result-card is-selected" : "result-card"}
                      key={item.id}
                      onClick={() => setSelectedOutputId(item.id)}
                      type="button"
                    >
                      <strong>{item.output_type}</strong>
                      <span>{new Date(item.updated_at).toLocaleString("nb-NO")}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="stack">
                {selectedOutput ? (
                  <CopyBlock title={selectedOutput.output_type} content={selectedOutput.content} />
                ) : (
                  <section className="card">
                    <p>Ingen output generert ennå.</p>
                  </section>
                )}
                <CopyBlock title="Eksporterbart utkast (JSON)" content={exportPayload} />
              </div>
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}
