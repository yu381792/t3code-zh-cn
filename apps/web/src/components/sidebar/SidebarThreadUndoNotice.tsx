import { useTranslate as useUiTranslate } from "~/i18n/translate";
import { useAtomValue } from "@effect/atom-react";

import { undoLatestThreadAction, useThreadUndoNotice } from "../../hooks/showThreadUndoNotice";
import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { Alert, AlertDescription } from "../ui/alert";
import { InlineButton } from "../ui/button";

export function SidebarThreadUndoNotice() {
  const t3T = useUiTranslate();

  const notice = useThreadUndoNotice((state) => state.notice);
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);

  if (!notice) return null;
  const shortcut = shortcutLabelForCommand(keybindings, "thread.undo");

  return (
    <Alert role="status" variant="sidebar">
      <AlertDescription>
        {notice.action} {notice.count} {t3T("thread")}
        {notice.count === 1 ? "" : t3T("s")},{" "}
        <InlineButton onClick={undoLatestThreadAction}>
          {shortcut ? t3T("{0} to undo", [shortcut]) : t3T("Undo")}
        </InlineButton>
      </AlertDescription>
    </Alert>
  );
}
