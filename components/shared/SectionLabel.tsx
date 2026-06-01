type Props = {
  children: React.ReactNode;
  variant?: "dark" | "light";
};

export default function SectionLabel({ children, variant = "dark" }: Props) {
  const color = variant === "dark" ? "text-accent-green" : "text-accent-teal";
  return (
    <span
      className={`block text-[11px] font-medium tracking-[1.5px] uppercase ${color}`}
    >
      {children}
    </span>
  );
}
