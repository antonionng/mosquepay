"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";
import { churchScopedEventPath } from "@/lib/public-links";

export function CopyPaymentLink({
  churchSlug,
  slug,
}: {
  churchSlug: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}${churchScopedEventPath(churchSlug, slug)}/pay`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Link2 className="mr-2 h-4 w-4" />
          Copy payment link
        </>
      )}
    </Button>
  );
}
