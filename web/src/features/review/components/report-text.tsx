/** Renders the report's small markdown subset (## headings, - bullets, paragraphs) without a parser dependency. */
export function ReportText({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}|\n(?=## |- )/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="grid gap-2">
      {blocks.map((b, i) =>
        b.startsWith('## ') ? (
          <h4 key={i} className="pt-1 text-sm font-medium text-foreground">{b.slice(3)}</h4>
        ) : b.startsWith('- ') ? (
          <ul key={i} className="ml-4 list-disc">{b.split(/\n(?=- )/).map((li, j) => <li key={j}>{li.replace(/^- /, '')}</li>)}</ul>
        ) : (
          <p key={i}>{b}</p>
        ),
      )}
    </div>
  );
}
