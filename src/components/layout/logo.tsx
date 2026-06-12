import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLink?: boolean;
};

const sizes = {
  sm: { width: 150, height: 52 },
  md: { width: 210, height: 72 },
  lg: { width: 300, height: 104 }
};

export function Logo({ className, size = "md", showLink = true }: LogoProps) {
  const { width, height } = sizes[size];
  const image = (
    <Image
      src="/logo-pv-solucoes.png"
      alt="PV Soluções — Crédito rápido e seguro"
      width={width}
      height={height}
      className={cn("h-auto max-w-full object-contain", className)}
      priority
    />
  );

  if (!showLink) return image;

  return (
    <Link href="/" className="inline-block transition-opacity hover:opacity-90">
      {image}
    </Link>
  );
}
