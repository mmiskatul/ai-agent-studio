/* eslint-disable react-refresh/only-export-components */
import "@/styles.css";
import { AppProviders } from "@/components/AppProviders";
export { metadata } from "@/app/metadata";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
