import { Banner } from "../../components/Banner";
import { useConnectionBanner } from "./use-connection-banner";

export interface ConnectionBannerProps {
  className?: string;
}

export function ConnectionBanner({ className }: ConnectionBannerProps) {
  const { banner, onAction } = useConnectionBanner();
  return (
    <Banner
      revealed={banner !== null}
      title={banner?.title ?? ""}
      tone={banner?.tone ?? "neutral"}
      buttonLabel={banner?.actionLabel}
      onButton={onAction}
      className={className}
    />
  );
}
