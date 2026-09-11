export default function LoadingWorkspace() {
  return <div role="status" aria-label="Loading workspace" className="space-y-5 p-6 motion-safe:animate-pulse"><span className="sr-only">Loading workspace…</span><div className="h-8 w-2/3 rounded bg-muted" /><div className="h-4 w-1/2 rounded bg-muted" /><div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-40 rounded-xl border bg-card" />)}</div></div>;
}
