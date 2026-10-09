/** Answer options that are code or data literals ("[0, 1, 4]" vs "{0, 1, 4}") render in monospace so brackets are unambiguous. */
export function OptionText({ text }: { text: string }) {
  const codeLike = /^[\[{(<'"@#.]/.test(text) || /^(?:[a-z_]+\(|SELECT |git |docker |df[.[]|let |const |typeof )/i.test(text) || /^[\d.]+(?:\/[\d.]+)?$/.test(text);
  return codeLike && !text.includes("`")
    ? <code className="font-mono text-[0.92em] text-ink">{text}</code>
    : <RichText text={text} />;
}

/** Renders `inline code` spans inside question text without using dangerouslySetInnerHTML. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.88em] text-electric-soft">{p.slice(1, -1)}</code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
