import { useTranslate as useUiTranslate } from "~/i18n/translate";
import type { ComponentProps } from "react";
import { OpenAI } from "../Icons";
import { Button } from "../ui/button";

export function ChatGptConnectionButton({ children, ...props }: ComponentProps<typeof Button>) {
  const t3T = useUiTranslate();

  return (
    <Button {...props}>
      <OpenAI className="size-4 shrink-0" aria-hidden="true" />
      {children ?? t3T("Continue with ChatGPT")}
    </Button>
  );
}
