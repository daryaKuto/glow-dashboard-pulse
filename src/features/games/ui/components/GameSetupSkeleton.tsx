import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RoomSelectionSkeleton,
  GroupSelectionSkeleton,
  TargetSelectionSkeleton,
} from '@/components/games';

export const StepOneSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-[10px] space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
          <Skeleton className="h-4 w-40 bg-gray-200" />
        </div>
        <Skeleton className="h-5 w-52 bg-gray-200" />
        <Skeleton className="h-3 w-60 bg-gray-200" />
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:items-start">
        <RoomSelectionSkeleton />
        <GroupSelectionSkeleton />
        <TargetSelectionSkeleton />
      </div>
    </CardContent>
  </Card>
);

export const StepTwoSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-[10px] space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
          <Skeleton className="h-4 w-32 bg-gray-200" />
        </div>
        <Skeleton className="h-5 w-48 bg-gray-200" />
        <Skeleton className="h-3 w-56 bg-gray-200" />
      </div>
      <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-gray-200" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-16 rounded-md bg-gray-200" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 bg-gray-200" />
          <Skeleton className="h-10 w-full rounded-md bg-gray-200" />
          <Skeleton className="h-3 w-48 bg-gray-200" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const StepThreeSkeleton: React.FC = () => (
  <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
    <CardContent className="p-[10px] space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-gray-200" />
          <Skeleton className="h-4 w-40 bg-gray-200" />
        </div>
        <Skeleton className="h-5 w-56 bg-gray-200" />
        <Skeleton className="h-3 w-64 bg-gray-200" />
      </div>
      <div className="flex flex-col gap-3 text-left items-stretch md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0">
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-32 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-40 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-32 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
        <div className="md:min-w-0">
          <div className="h-full rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px] text-left">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-md bg-gray-200" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28 bg-gray-200" />
                <Skeleton className="h-4 w-36 bg-gray-200" />
                <Skeleton className="h-3 w-32 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <Skeleton className="h-9 w-full sm:w-40 rounded-md bg-gray-200" />
        <Skeleton className="h-10 w-full sm:w-48 rounded-md bg-gray-200" />
      </div>
      <Skeleton className="h-3 w-64 bg-gray-200" />
    </CardContent>
  </Card>
);
