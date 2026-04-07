type PublicNoticeProps = {
  compact?: boolean;
};

export function PublicNotice({ compact = false }: PublicNoticeProps) {
  return (
    <section className={compact ? "public-notice public-notice--compact" : "public-notice"}>
      <p className="public-notice__eyebrow">Lokal arbeidsflate</p>
      <h3>Utkast lagres bare i denne nettleseren.</h3>
      <p>
        Løsningen publiserer ikke saken som en offentlig saksdatabase. Legg likevel ikke inn mer personinformasjon enn
        nødvendig, og eksporter bare det du faktisk trenger videre.
      </p>
    </section>
  );
}
