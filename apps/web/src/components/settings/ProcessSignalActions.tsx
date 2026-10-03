import { useTranslate as useUiTranslate } from "~/i18n/translate";
import type { ServerProcessSignal } from "@t3tools/contracts";

import { InlineButton } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** Process ownership and confirmation stay with the diagnostics view. */
export function ProcessSignalActions({
  disabled,
  onSignal,
}: {
  disabled: boolean;
  onSignal: (signal: ServerProcessSignal) => void;
}) {
  const t3T = useUiTranslate();

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={t3T("Send SIGINT")}
              tone="muted"
              onClick={() => onSignal("SIGINT")}
            >
              {t3T("INT")}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{t3T("Send SIGINT")}</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={t3T("Send SIGKILL")}
              tone="destructive"
              onClick={() => onSignal("SIGKILL")}
            >
              {t3T("KILL")}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{t3T("Send SIGKILL")}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
