import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PublicNotice } from "../../components/PublicNotice";
import { StatusBadge } from "../../components/StatusBadge";
import { listLocalCaseRecords } from "../../lib/localDrafts";
import { caseStatusOptions, issueTypeOptions } from "../../lib/types";

export function CasesPage() {
  const [filters, setFilters] = useState({
    search: "",
    municipality: "",
    status: "",
    issueType: "",
  });

  const cases = listLocalCaseRecords();

  const visibleCases = useMemo(() => {
    return cases.filter((caseRecord) => {
      const matchesSearch = filters.search
        ? caseRecord.title.toLowerCase().includes(filters.search.toLowerCase())
        : true;
      const matchesMunicipality = filters.municipality
        ? caseRecord.municipality.toLowerCase().includes(filters.municipality.toLowerCase())
        : true;
      const matchesStatus = filters.status ? caseRecord.current_status === filters.status : true;
      const matchesIssueType = filters.issueType ? caseRecord.issue_type === filters.issueType : true;

      return matchesSearch && matchesMunicipality && matchesStatus && matchesIssueType;
    });
  }, [cases, filters]);

  return (
    <div className="page stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Lokale utkast</p>
            <h1>Alle utkast i denne nettleseren</h1>
          </div>
        </div>

        <PublicNotice />

        <div className="form-grid">
          <label className="field">
            <span>Søk i tittel</span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Kommune</span>
            <input
              value={filters.municipality}
              onChange={(event) => setFilters((current) => ({ ...current, municipality: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">Alle</option>
              {caseStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Type</span>
            <select
              value={filters.issueType}
              onChange={(event) => setFilters((current) => ({ ...current, issueType: event.target.value }))}
            >
              <option value="">Alle</option>
              {issueTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        {visibleCases.length === 0 ? <p>Ingen lokale utkast matcher filtrene.</p> : null}

        <div className="cases-table">
          {visibleCases.map((caseRecord) => (
            <Link className="case-row" key={caseRecord.id} to={`/cases/${caseRecord.id}`}>
              <div>
                <strong>{caseRecord.title}</strong>
                <p>{caseRecord.summary ?? "Ingen oppsummering registrert."}</p>
              </div>
              <div className="case-row__meta">
                <span>{caseRecord.municipality}</span>
                <StatusBadge>{caseRecord.current_status}</StatusBadge>
                <StatusBadge tone="fact">{caseRecord.issue_type}</StatusBadge>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
