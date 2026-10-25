import { buildLandingMetadata } from "@/landing/metadata";
import { SubscribePage } from "@/components/landing/SubscribePage";

export const revalidate = 3600;

export const metadata = buildLandingMetadata({
  lang: "el",
  routeKey: "subscribe",
  title: "GR Wire — Η ελληνική αγορά τηλεπικοινωνιών και ίνας σε ένα email",
  description: "Ένα email κάθε εβδομάδα με τα σημαντικά της αγοράς, τις αποφάσεις των ρυθμιστών και τους μεγάλους διαγωνισμούς. Κάθε αριθμός έχει πηγή και ημερομηνία.",
});

export default function Page() {
  return <SubscribePage lang="el" />;
}
