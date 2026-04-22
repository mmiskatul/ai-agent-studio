"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function AuthenticatedLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <Skeleton className="h-10 w-full sm:w-72" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
