"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";

const schema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  work_email: z.string().email("Valid work email is required"),
  lodge_name: z.string().min(1, "Lodge name is required"),
  role: z.string().min(1, "Role is required"),
  lodge_count: z.coerce.number().min(1).max(500).default(1),
  priorities: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function BookDemoForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      lodge_count: 1,
    },
  });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not submit demo request");
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.25rem] border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-600" />
        <p className="font-semibold text-slate-900">Demo request received</p>
        <p className="mt-2 text-sm text-slate-600">
          Thanks. We will reach out shortly to schedule your LodgePay walkthrough, and a confirmation email is on its way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name *</Label>
          <Input
            id="full_name"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            {...register("full_name")}
          />
          {errors.full_name ? (
            <p className="text-sm text-red-600">{errors.full_name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="work_email">Work email *</Label>
          <Input
            id="work_email"
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            enterKeyHint="next"
            {...register("work_email")}
          />
          {errors.work_email ? (
            <p className="text-sm text-red-600">{errors.work_email.message}</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lodge_name">Lodge or group name *</Label>
          <Input id="lodge_name" {...register("lodge_name")} />
          {errors.lodge_name ? (
            <p className="text-sm text-red-600">{errors.lodge_name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Your role *</Label>
          <Input id="role" {...register("role")} placeholder="Secretary, Treasurer, Admin..." />
          {errors.role ? <p className="text-sm text-red-600">{errors.role.message}</p> : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="lodge_count">How many lodges do you manage?</Label>
        <Input
          id="lodge_count"
          type="number"
          min={1}
          max={500}
          inputMode="numeric"
          enterKeyHint="next"
          {...register("lodge_count")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="priorities">Top priorities</Label>
        <Textarea
          id="priorities"
          rows={4}
          {...register("priorities")}
          placeholder="Website refresh, event payments, candidate CRM, reporting..."
        />
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Sending..." : "Request Demo"}
      </Button>
    </form>
  );
}

