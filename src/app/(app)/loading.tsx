import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[30rem] w-full rounded-xl" />
    </div>
  );
}
