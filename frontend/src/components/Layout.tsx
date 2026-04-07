import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { PublicNotice } from "./PublicNotice";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <Link className="brand" to="/">
            kommune
          </Link>
          <p className="brand__subtitle">Strukturert arbeid med kommunesaker, dokumentasjon og forsiktig klageforberedelse.</p>
          <PublicNotice compact />
        </div>

        <nav className="topnav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/cases">Utkast</NavLink>
        </nav>
      </header>

      <main className="shell__main">{children}</main>
    </div>
  );
}
