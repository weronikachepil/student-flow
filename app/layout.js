import "./globals.css";

export const metadata = {
  title: "Student Flow",
  description: "Студентський простір для розкладу, задач, оголошень і особистого планування.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
