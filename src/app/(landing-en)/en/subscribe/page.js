import { buildLandingMetadata } from "@/landing/metadata";
import { SubscribePage } from "@/components/landing/SubscribePage";

export const revalidate = 3600;

export const metadata = buildLandingMetadata({
  lang: "en",
  routeKey: "subscribe",
  title: "GR Wire — Greek telecom and fibre, every morning",
  description: "A short email every weekday with the market news, regulator decisions and tenders, plus our comment on what they mean. Every figure carries its source and date.",
});

export default function Page() {
  return <SubscribePage lang="en" />;
}
