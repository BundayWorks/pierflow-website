type Props = {
  title: string;
  body: string;
  variant?: "dark" | "light";
};

export default function FeatureCard({ title, body, variant = "light" }: Props) {
  if (variant === "dark") {
    return (
      <div className="bg-dark-surface border border-dark-border rounded-lg p-5">
        <h3 className="text-[15px] font-medium text-white">{title}</h3>
        <p className="mt-2 text-[13px] leading-[1.6] text-textd-secondary">
          {body}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-[#eaeaea] rounded-lg p-5">
      <h3 className="text-[15px] font-medium text-textl-primary">{title}</h3>
      <p className="mt-2 text-[13px] leading-[1.6] text-textl-secondary">
        {body}
      </p>
    </div>
  );
}
