import Link from "next/link";
import { Button } from "@/app/_shared/components/ui/button/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="max-w-md w-full mx-4 p-8 text-center">
        <h1 className="text-9xl font-bold text-[var(--color-primary-600)] mb-4">
          404
        </h1>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
          Page not found
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-8">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="primary" size="lg">
            Go home
          </Button>
        </Link>
      </div>
    </div>
  );
}
