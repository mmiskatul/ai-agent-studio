/* eslint-disable react-refresh/only-export-components */
import "@/styles.css";
import { Toaster } from "@/components/ui/sonner";
export { metadata } from "@/app/metadata";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
