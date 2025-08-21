// app/layout.js
import './globals.css';

export const metadata = {
  title: 'IT Team Calendar',
  description: 'Shared team calendar',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* FullCalendar styles via CDN */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.14/index.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fullcalendar/timegrid@6.1.14/index.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}


