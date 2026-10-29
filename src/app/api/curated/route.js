import { revalidatePath } from "next/cache";
import { ensureDatabase } from "@/database";
import { handleCuratedRequest } from "@/curated-handler";

export const maxDuration = 60;

// Editor-curated stories. Authenticated by CURATED_INGEST_SECRET (Bearer), not by the dashboard
// session; see src/curated.js for validation and storage.
export async function POST(request) {
  return handleCuratedRequest(request, {
    env: process.env,
    getSql: ensureDatabase,
    revalidate: () => revalidatePath("/", "layout"),
  });
}
