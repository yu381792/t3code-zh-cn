import { useTranslate as useUiTranslate } from "~/i18n/translate";
import type { ComponentProps } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { CHATGPT_USAGE_URL } from "@t3tools/shared/usageLimits";
import { ensureLocalApi } from "../../localApi";
import { Button } from "../ui/button";

export function ChatGptUsageButton(props: Omit<ComponentProps<typeof Button>, "onClick">) {
  const t3T = useUiTranslate();

  return (
    <Button
      variant="ghost-muted"
      size="sm"
      {...props}
      onClick={() => void ensureLocalApi().shell.openExternal(CHATGPT_USAGE_URL)}
    >
      {t3T("Manage usage")}
      <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
    </Button>
  );
}
