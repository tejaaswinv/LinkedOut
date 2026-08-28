import './globals.css';

export const metadata = {
  title: 'LinkedOut — Tell the truth about work',
  description: 'Verified, pseudonymous workplace experiences and company culture intelligence.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
