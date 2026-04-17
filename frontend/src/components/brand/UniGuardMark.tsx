import { cn } from "@/lib/utils";

const LOGO_SRC = "/logo.png";

type Props = {
  size?: number;
  className?: string;
};

/**
 * Official UniGuard Expense Tracker logo (shield + growth arrow) — asset in `/public/logo.png`.
 */
export function UniGuardMark({ size = 40, className }: Props) {
  return (
    <img
      src={LOGO_SRC}
      width={size}
      height={size}
      alt=""
      className={cn("shrink-0 object-contain select-none pointer-events-none", className)}
      decoding="async"
      draggable={false}
    />
  );
}
