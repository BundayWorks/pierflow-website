export default function Progress({
  step,
  total = 3,
  labels,
}: {
  step: number; // 1-based
  total?: number;
  labels?: string[];
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < step;
          return (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                filled ? "bg-accent-emerald" : "bg-black/[0.08]"
              }`}
            />
          );
        })}
      </div>
      <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium">
        Step {step} of {total}
        {labels && labels[step - 1] ? (
          <span className="ml-2 text-accent-ink/40 normal-case tracking-normal font-normal">
            · {labels[step - 1]}
          </span>
        ) : null}
      </p>
    </div>
  );
}
