import { cn } from "@/lib/utils";

interface SkeletonShimmerProps {
  className?: string;
}

export function SkeletonShimmer({ className }: SkeletonShimmerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted rounded-lg",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "before:animate-shimmer",
        className
      )}
    />
  );
}

export function EventCardSkeleton({ large }: { large?: boolean }) {
  return (
    <div className={cn("flex-shrink-0", large ? "w-64" : "w-40")}>
      <div className="overflow-hidden rounded-xl bg-card border border-border">
        <SkeletonShimmer className={cn(large ? "aspect-[4/3]" : "aspect-[3/4]")} />
        <div className="p-3 space-y-2">
          <SkeletonShimmer className="h-4 w-3/4" />
          <SkeletonShimmer className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function CarouselSkeleton({ count = 4, large }: { count?: number; large?: boolean }) {
  return (
    <div className="flex gap-4 overflow-hidden px-4">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} large={large} />
      ))}
    </div>
  );
}
