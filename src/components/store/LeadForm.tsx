"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button } from "./Button";

type Status = "idle" | "sending" | "done" | "error";

// Email-capture form shared by "Notify me when it's back" (product page) and
// the footer newsletter (Phase 7 step 4). `kind` picks the copy namespace,
// endpoint and test ids. The `website` input is the honeypot: visually hidden
// and out of the tab order, so only bots fill it.
export function LeadForm({
  kind,
  designId,
  variantId,
}: {
  kind: "notify" | "newsletter";
  designId?: string;
  variantId?: string;
}) {
  const t = useTranslations("leads");
  const locale = useLocale();
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(`/api/leads/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          website,
          ...(kind === "notify" ? { designId, variantId } : {}),
        }),
      });
      setStatus(res.status === 204 ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" data-testid={`${kind}-success`} className="text-sm font-medium text-accent">
        {t(`${kind}.success`)}
      </p>
    );
  }

  // Silver Mist: both forms are a single mist pill holding the input and the
  // button. The newsletter's label is visually hidden because the footer
  // heading above the form says what it is; the notify form shows its label.
  const pill = kind === "newsletter";

  return (
    <form onSubmit={handleSubmit} data-testid={`${kind}-form`} className="flex flex-col gap-2">
      <label htmlFor={inputId} className={pill ? "sr-only" : "text-sm font-medium text-ink"}>
        {t(`${kind}.title`)}
      </label>
      <div className="flex gap-1.5 rounded-full bg-mist p-[5px] lg:p-1.5">
        <input
          id={inputId}
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-label={t("emailLabel")}
          data-testid={`${kind}-email`}
          className={`h-11 min-w-0 flex-1 rounded-full bg-transparent px-3.5 text-[15px] placeholder:text-muted lg:h-12 lg:px-[18px] ${
            pill ? "lg:w-[260px] lg:flex-none" : ""
          }`}
        />
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        <Button
          type="submit"
          disabled={status === "sending"}
          data-testid={`${kind}-submit`}
          className="shrink-0 lg:h-12"
        >
          {status === "sending" ? t(`${kind}.sending`) : t(`${kind}.submit`)}
        </Button>
      </div>
      {status === "error" && (
        <p role="alert" className="px-1 text-sm text-red-700">
          {t("error")}
        </p>
      )}
    </form>
  );
}
