import { buildLandingMetadata } from "@/landing/metadata";
import { SubscribePage } from "@/components/landing/SubscribePage";

export const revalidate = 3600;

export const metadata = buildLandingMetadata({
  lang: "el",
  routeKey: "subscribe",
  title: "GR Wire — Η ελληνική αγορά τηλεπικοινωνιών και ίνας, κάθε πρωί",
  description: "Κάθε εργάσιμη ένα σύντομο email με τα νέα της αγοράς, τις αποφάσεις των ρυθμιστών και τους διαγωνισμούς, μαζί με το σχόλιό μας. Κάθε αριθμός έχει πηγή και ημερομηνία.",
});

export default function Page() {
  return <SubscribePage lang="el" />;
}
