import { JetBrains_Mono, Source_Sans_3, Source_Serif_4 } from "next/font/google";

// Mockup weights: JetBrains Mono 500/700, Source Sans 3 400/600/700, Source Serif 4 600/700.
// Greek subset is required alongside latin since the EL route renders Greek copy.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin", "greek"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "greek"],
  weight: ["600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const landingFontVariables = `${jetbrainsMono.variable} ${sourceSans.variable} ${sourceSerif.variable}`;
