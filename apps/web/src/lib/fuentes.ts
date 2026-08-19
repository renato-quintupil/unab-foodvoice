import { Bricolage_Grotesque } from 'next/font/google';

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
});

export const claseBricolage = bricolageGrotesque.className;
