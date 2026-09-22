export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-4 py-8 sm:px-6">
      {children}
    </div>
  );
}
