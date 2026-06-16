import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventForm } from "@/components/forms/event-form";

export default function NewEventPage() {
  return (
    <div>
      <div className="mb-8">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/services">Back to services</Link>
        </Button>
      </div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-dash-text">New calendar item</h1>
      <p className="mb-8 text-dash-muted">Create a new mosque service or public calendar item.</p>
      <EventForm />
    </div>
  );
}
