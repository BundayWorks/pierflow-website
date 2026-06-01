type Props = {
  label: string;
  variant?: "dark" | "light";
};

export default function AiScoreBadge({ label, variant = "dark" }: Props) {
  const classes =
    variant === "dark"
      ? "bg-accent-green-dim text-accent-green"
      : "bg-accent-teal-light text-accent-teal";
  return (
    <span
      className={`inline-block font-mono text-[10px] px-2 py-1 rounded-sm ${classes}`}
    >
      {label}
    </span>
  );
}
