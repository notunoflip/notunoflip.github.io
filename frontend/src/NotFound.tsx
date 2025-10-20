// src/pages/NotFound.tsx
export default function NotFound() {
  return (
    <div className="text-white flex flex-col items-center justify-center h-screen text-gray-800 dark:text-gray-200">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-xl">Page Not Found</p>
      <a
        href="/"
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Go Home
      </a>
    </div>
  );
}