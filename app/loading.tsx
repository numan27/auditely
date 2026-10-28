import { PageLoader } from '@/app/_shared/components/auditely/pageLoader/pageLoader';

// While a page loads: Auditely's gauge taking a reading (pageLoader.tsx)
export default function Loading() {
  return <PageLoader />;
}

// The plain spinner it replaced:
// export default function Loading() {
//   return (
//     <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
//       <div className="flex flex-col items-center gap-4">
//         <div className="w-12 h-12 border-4 border-[var(--color-primary-200)] border-t-[var(--color-primary-600)] rounded-full animate-spin"></div>
//         <p className="text-[var(--color-text-secondary)]">Loading...</p>
//       </div>
//     </div>
//   );
// }
