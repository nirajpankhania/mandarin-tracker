/** Gold band at the top of each page, ending in the wavy edge. */
export function Hero({ overline, title, children, aside }: { overline?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="band-gold overflow-hidden">
      <div className={`wrap grid gap-10 ${aside ? "md:grid-cols-[1fr_1.1fr] md:items-center" : ""}`}>
        <div className="rise">
          {overline && <p className="eyebrow eyebrow-accent">{overline}</p>}
          <h1 className="mt-3">{title}</h1>
          {children}
        </div>
        {aside}
      </div>
      <div className="wave" aria-hidden />
    </section>
  );
}
