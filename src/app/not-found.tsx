import Link from "next/link";
import { HouseMark } from "@/components/house-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-grain px-4 text-center">
      <HouseMark className="mb-5 size-10" />
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">This room doesn&rsquo;t exist. Let&rsquo;s get you back to the calendar.</p>
      <Button className="mt-6" render={<Link href="/calendar" />} nativeButton={false}>
        Back to the calendar
      </Button>
    </main>
  );
}
