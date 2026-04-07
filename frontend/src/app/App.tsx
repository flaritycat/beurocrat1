import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { DashboardPage } from "../features/cases/DashboardPage";
import { CasesPage } from "../features/cases/CasesPage";
import { CaseWorkspacePage } from "../features/cases/CaseWorkspacePage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route element={<DashboardPage />} path="/" />
        <Route element={<CasesPage />} path="/cases" />
        <Route element={<CaseWorkspacePage />} path="/cases/:id" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </Layout>
  );
}
