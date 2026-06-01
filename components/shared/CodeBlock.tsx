type Props = {
  filename?: string;
  rightBadge?: React.ReactNode;
  children: React.ReactNode;
};

export default function CodeBlock({ filename, rightBadge, children }: Props) {
  return (
    <div className="rounded-lg overflow-hidden border border-dark-border bg-dark-surface">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-border bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c940]" />
          {filename && (
            <span className="ml-3 text-[11px] text-textd-muted font-mono">
              {filename}
            </span>
          )}
        </div>
        {rightBadge}
      </div>
      <pre className="p-5 text-[12px] leading-[1.7] font-mono overflow-x-auto text-white">
        {children}
      </pre>
    </div>
  );
}
