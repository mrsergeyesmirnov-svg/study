import { useState } from "react";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
};

function Empty({ className, style, alt }: { className?: string; style?: React.CSSProperties; alt?: string }) {
  return (
    <div
      className={className}
      style={{
        aspectRatio: "1",
        background: "linear-gradient(145deg, #1a1a1a, #2a2a2a)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#555",
        fontSize: "0.75rem",
        ...style,
      }}
      aria-label={alt || "Нет фото"}
    >
      нет фото
    </div>
  );
}

/** Image that never shows a broken-icon placeholder. */
export function ProductPhoto({ src, alt = "", className, style }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <Empty className={className} style={style} alt={alt} />;
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
