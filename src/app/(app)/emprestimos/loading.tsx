export default function EmprestimosLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-10 w-56 rounded-md bg-muted" />
      </div>
      <div className="rounded-lg border p-4">
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <div className="h-10 rounded-md bg-muted" />
          <div className="h-10 rounded-md bg-muted" />
          <div className="h-10 rounded-md bg-muted md:col-span-2" />
        </div>
        <div className="mb-3 h-4 w-64 rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-muted/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
