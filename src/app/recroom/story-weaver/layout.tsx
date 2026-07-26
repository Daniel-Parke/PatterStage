import localFont from "next/font/local";

// The Story Weaver reader's four serif faces, vendored rather than fetched
// (WG-DEL-004, ruled C: determinism first). They were next/font/google, which made
// `next build` reach the network and forced CI to carry a font warmup and a
// whole-build retry.
//
// Worth knowing: WG-WEB-010 rules the house set as a trio (Space Grotesk display,
// Inter text, JetBrains Mono), and the 2026-07 review recorded these four as a
// design-system fork. They may be deleted rather than kept. Vendoring does not make
// that harder, since removal is then a file delete, and until it happens the build
// is at least deterministic.
//
// All four are variable fonts, so one file each covers the range the CSS API used
// to serve. Merriweather previously requested three discrete weights; the variable
// file spans them.
const literata = localFont({
  src: "../../fonts/Literata.woff2",
  variable: "--font-literata",
  weight: "200 900",
  display: "swap",
});
const ebGaramond = localFont({
  src: "../../fonts/EBGaramond.woff2",
  variable: "--font-eb-garamond",
  weight: "400 800",
  display: "swap",
});
const lora = localFont({
  src: "../../fonts/Lora.woff2",
  variable: "--font-lora",
  weight: "400 700",
  display: "swap",
});
const merriweather = localFont({
  src: "../../fonts/Merriweather.woff2",
  variable: "--font-merriweather",
  weight: "300 700",
  display: "swap",
});

export default function StoryWeaverLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${literata.variable} ${ebGaramond.variable} ${lora.variable} ${merriweather.variable}`}>
      {children}
    </div>
  );
}
