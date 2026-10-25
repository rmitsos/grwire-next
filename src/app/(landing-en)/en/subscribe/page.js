import { buildLandingMetadata } from "@/landing/metadata";
import { SubscribePage } from "@/components/landing/SubscribePage";

export const revalidate = 3600;

export const metadata = buildLandingMetadata({
  lang: "en",
  routeKey: "subscribe",
  title: "GR Wire — Greek telecom and fibre in one weekly email",
  description: "One email a week with the main market news, regulator decisions and large tenders. Every figure carries its source and date.",
});

export default function Page() {
  return <SubscribePage lang="en" />;
}
