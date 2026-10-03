import { useTranslate as useUiTranslate } from "~/i18n/translate";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button, InlineButton } from "../ui/button";
import { useT3ConnectAccountPage } from "./T3ConnectAccountPages";

/**
 * Confirms removing a T3 Connect environment from this device. Removal here
 * leaves the account registration (and its host space) in place, so the dialog
 * says so and links to the account page where it can be deregistered.
 */
export function RemoveT3ConnectEnvironmentDialog({
  environmentLabel,
  onCancel,
  onConfirm,
}: {
  /** The environment awaiting confirmation; null keeps the dialog closed. */
  readonly environmentLabel: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const t3T = useUiTranslate();

  const accountPage = useT3ConnectAccountPage();
  // Keep the label through the close animation.
  const [shownLabel, setShownLabel] = useState(environmentLabel);
  if (environmentLabel !== null && environmentLabel !== shownLabel) setShownLabel(environmentLabel);
  const openAccountPage = accountPage.open;

  return (
    <>
      <AlertDialog
        open={environmentLabel !== null}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t3T("Remove")} {shownLabel} {t3T("from this device?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t3T("This forgets its pairing, credentials, and cached threads here.")}
            </AlertDialogDescription>
            <AlertDialogDescription>
              {t3T(
                "It stays on your T3 Connect account and keeps its host space. Deregister it in",
              )}{" "}
              {openAccountPage ? (
                <InlineButton
                  onClick={() => {
                    onCancel();
                    openAccountPage();
                  }}
                >
                  {t3T("T3 Connect settings")}
                </InlineButton>
              ) : (
                t3T("T3 Connect settings")
              )}{" "}
              {t3T("to free it.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              {t3T("Cancel")}
            </AlertDialogClose>
            <Button variant="destructive" onClick={onConfirm}>
              {t3T("Remove from this device")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
      {accountPage.portals}
    </>
  );
}
