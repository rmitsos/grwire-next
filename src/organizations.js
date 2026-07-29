export const ORGANIZATIONS = Object.freeze([
  { id: "ote", name: "OTE Group / Cosmote", aliases: ["ΟΤΕ", "Cosmote", "Cosmote Telekom"] },
  { id: "vodafone-gr", name: "Vodafone Greece", aliases: ["Vodafone Ελλάδας"] },
  { id: "nova-gr", name: "Nova Greece", aliases: ["Nova", "Wind Hellas"] },
  { id: "eett", name: "EETT", aliases: ["ΕΕΤΤ"] },
  { id: "ppc", name: "PPC Group", aliases: ["ΔΕΗ", "PPC", "DEI"] },
  { id: "ppc-fiber", name: "PPC FiberGrid", aliases: ["ΔΕΗ Fiber", "FiberGrid"] },
  { id: "admie", name: "IPTO / ADMIE", aliases: ["ΑΔΜΗΕ", "IPTO"] },
  { id: "deddie", name: "HEDNO / DEDDIE", aliases: ["ΔΕΔΔΗΕ", "HEDNO"] },
  { id: "desfa", name: "DESFA", aliases: ["ΔΕΣΦΑ"] },
  { id: "raaey", name: "RAAEY", aliases: ["ΡΑΑΕΥ"] },
  { id: "alpha-bank", name: "Alpha Bank", aliases: [] },
  { id: "eurobank", name: "Eurobank", aliases: [] },
  { id: "nbg", name: "National Bank of Greece", aliases: ["Εθνική Τράπεζα"] },
  { id: "piraeus-bank", name: "Piraeus Bank", aliases: ["Τράπεζα Πειραιώς"] },
  { id: "circet-hellas", name: "Circet Hellas", aliases: ["Circet"] },
]);

export const ORGANIZATION_BY_ID = Object.freeze(
  Object.fromEntries(ORGANIZATIONS.map((organization) => [organization.id, organization])),
);
