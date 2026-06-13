export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJson(data) }}
      type="application/ld+json"
    />
  );
}

function safeJson(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
