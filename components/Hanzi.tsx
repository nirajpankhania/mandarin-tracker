/** A word set in practice-grid cells, one character per cell. */
export function Hanzi({ text }: { text: string }) {
  const chars = Array.from(text);
  if (chars.length > 6) return <span className="hanzi text-3xl">{text}</span>;
  return (
    <span className="inline-flex" lang="zh">
      {chars.map((c, i) => (
        <span key={i} className="zi">{c}</span>
      ))}
    </span>
  );
}
