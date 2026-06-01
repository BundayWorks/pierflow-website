type Props = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { h: 18, w: 130, text: 14, mark: 32 },
  md: { h: 22, w: 150, text: 15, mark: 38 },
  lg: { h: 30, w: 200, text: 20, mark: 50 },
};

export default function Logo({ variant = "light", size = "md" }: Props) {
  const s = SIZES[size];
  // light variant = teal mark + white text (for dark backgrounds like the nav)
  // dark variant = teal mark + dark text (for light backgrounds)
  const markColor = "#0DCE9A";
  const textColor = variant === "light" ? "#FFFFFF" : "#0A7C6E";

  return (
    <span
      className="inline-flex items-center gap-2.5 select-none"
      aria-label="Pierflow"
    >
      <svg
        width={s.mark}
        height={s.mark * 0.45}
        viewBox="0 0 80 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* arc connecting the two endpoints */}
        <path
          d="M10 24 C 22 -2, 50 -2, 64 22"
          stroke={markColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* left filled dot */}
        <circle cx="10" cy="24" r="6.5" fill={markColor} />
        {/* right ring */}
        <circle
          cx="64"
          cy="24"
          r="5"
          stroke={markColor}
          strokeWidth="3"
          fill="none"
        />
      </svg>
      <span
        className="font-medium tracking-[0.18em] uppercase"
        style={{ fontSize: s.text, color: textColor }}
      >
        Pierflow
      </span>
    </span>
  );
}
