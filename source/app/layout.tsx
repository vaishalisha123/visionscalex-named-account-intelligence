import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'VisionScaleX — Account Intelligence',
  description: 'Select the right accounts. Sense commercial change. Build qualified business conversations.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
