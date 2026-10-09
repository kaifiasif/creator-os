import { Skeleton } from '@/components/ui/skeleton';

export function DraftsSkeleton() {
  return (
    <div className="grid gap-4" aria-busy aria-label="Loading drafts">
      <div className="grid grid-cols-2 gap-4 @5xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
