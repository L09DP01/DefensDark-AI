import type { FC } from "react";
import Image from "next/image";

interface DefensDarkAISVGProps {
  theme: "dark" | "light";
  scale?: number;
}

export const DefensDarkAISVG: FC<DefensDarkAISVGProps> = ({
  theme,
  scale = 1,
}) => {
  // Original SVG was 189x194 at scale=1
  const width = Math.round(189 * scale);
  const height = Math.round(194 * scale);

  return (
    <Image
      src="/logo.png"
      alt="DefensDark AI"
      width={width}
      height={height}
      className="object-contain"
      priority
    />
  );
};
