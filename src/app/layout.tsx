import type { Metadata } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({ subsets: ["latin", "latin-ext"], variable: "--font-display", weight: ["500", "600", "700"] });
const body = Source_Sans_3({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "TUBES AI — промисловий каталог",
  description: "1 736 позицій промислових шлангів, арматури, гідравліки та обладнання з експертним пошуком.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uk"><body className={`${display.variable} ${body.variable}`}>{children}</body></html>;
}
