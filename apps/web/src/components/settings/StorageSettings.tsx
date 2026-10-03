import { useTranslate as useUiTranslate } from "~/i18n/translate";
import type { StorageCleanupSettings, WorktreeCleanupRules } from "@t3tools/contracts";
import { resolveWorktreeCleanup } from "@t3tools/shared/projectSettings";
import { useState } from "react";

import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "../ui/number-field";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { SettingsScopeNotice } from "./SettingsScopeNotice";
import type { ScopedSettingsTarget } from "./scopedSettings";
import { useSettingsScope } from "./SettingsScopeContext";
import {
  useClearScopedSettings,
  useScopedSettings,
  useUpdateScopedSettings,
} from "./useScopedSettings";

function RetentionControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const t3T = useUiTranslate();

  const [draft, setDraft] = useState(value);
  const [savedValue, setSavedValue] = useState(value);
  if (savedValue !== value) {
    setSavedValue(value);
    setDraft(value);
  }

  return (
    <div className="flex items-center gap-3">
      {value !== null ? (
        <NumberField
          value={draft}
          min={1}
          max={3650}
          step={1}
          size="sm"
          className="w-auto"
          onValueChange={setDraft}
          onValueCommitted={(next) => {
            if (next === null) setDraft(value);
            else {
              const days = Math.min(3650, Math.max(1, Math.round(next)));
              setDraft(days);
              onChange(days);
            }
          }}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement aria-label={t3T("Decrease {0}", [label])} />
            <NumberFieldInput
              aria-label={t3T("{0} in days", [label])}
              size={new Intl.NumberFormat().format(draft ?? value).length}
              className="field-sizing-content w-auto min-w-[1ch] grow-0 text-right"
            />
            <span aria-hidden="true" className="self-center pr-2 text-xs">
              {t3T("days")}
            </span>
            <NumberFieldIncrement aria-label={t3T("Increase {0}", [label])} />
          </NumberFieldGroup>
        </NumberField>
      ) : (
        <span className="text-xs text-muted-foreground">{t3T("Off")}</span>
      )}
      <Switch
        aria-label={t3T(label)}
        checked={value !== null}
        onCheckedChange={(enabled) => onChange(enabled ? 8 : null)}
      />
    </div>
  );
}

export function StorageSettingsPanel() {
  const t3T = useUiTranslate();

  const { scope, connectedEnvironments, targets, target } = useSettingsScope();
  const scopedSettings = useScopedSettings();
  const isProjectScope = scope.kind === "project" || scope.kind === "checkout";
  const settings = {
    ...scopedSettings.storageCleanup,
    ...resolveWorktreeCleanup(scopedSettings, null),
  };
  const projectMode = (entry: ScopedSettingsTarget | null) =>
    entry?.sources.worktreeCleanup === "project"
      ? (entry.settings.worktreeCleanup?.mode ?? "inherit")
      : "inherit";
  const mode = projectMode(target);
  const mixedModes = targets.some((entry) => projectMode(entry) !== mode);
  const updateSettings = useUpdateScopedSettings();
  const clearSettings = useClearScopedSettings();
  const ruleStatus = (key: keyof StorageCleanupSettings) =>
    targets.some(
      (target) =>
        ({ ...target.settings.storageCleanup, ...resolveWorktreeCleanup(target.settings, null) })[
          key
        ] !== settings[key],
    )
      ? "Mixed across selected machines"
      : undefined;
  const update = (patch: Partial<StorageCleanupSettings>) =>
    updateSettings({ storageCleanup: patch });
  const updateWorktree = (patch: Partial<WorktreeCleanupRules>) =>
    isProjectScope
      ? updateSettings({ worktreeCleanup: { mode: "custom", rules: patch } })
      : update(patch);

  if (
    isProjectScope &&
    connectedEnvironments.some(
      (environment) =>
        environment.serverConfig?.environment.capabilities.projectWorktreeCleanup !== true,
    )
  ) {
    return (
      <SettingsScopeNotice target="all">
        {t3T("Update the selected machines to configure project worktree cleanup.")}
      </SettingsScopeNotice>
    );
  }

  if (
    connectedEnvironments.some(
      (environment) => environment.serverConfig?.environment.capabilities.storageCleanup !== true,
    )
  ) {
    return (
      <SettingsScopeNotice
        target="environment"
        eligibleEnvironmentIds={connectedEnvironments
          .filter(
            (environment) =>
              environment.serverConfig?.environment.capabilities.storageCleanup === true,
          )
          .map((environment) => environment.environmentId)}
      >
        {t3T(
          "Update the selected environments to use storage cleanup, or choose a machine that supports it.",
        )}
      </SettingsScopeNotice>
    );
  }

  return (
    <SettingsPageContainer>
      <SettingsSection id="storage-worktrees" title={t3T("Worktrees")}>
        {isProjectScope && (
          <SettingsRow
            title={t3T("Automatic worktree cleanup")}
            description={
              mode === "off"
                ? t3T("Keep this project's worktrees until you delete them manually.")
                : mode === "custom"
                  ? t3T("Use these rules for this project.")
                  : t3T("Use each machine's worktree cleanup settings.")
            }
            serverScoped
            settingKeys={["worktreeCleanup"]}
            mixed={mixedModes}
            control={
              <Select
                value={mixedModes ? null : mode}
                onValueChange={(next) => {
                  if (next === "inherit") clearSettings(["worktreeCleanup"]);
                  else if (next === "off") updateSettings({ worktreeCleanup: { mode: "off" } });
                  else if (next === "custom")
                    updateSettings({ worktreeCleanup: { mode: "custom", rules: {} } });
                }}
              >
                <SelectTrigger size="sm" aria-label={t3T("Automatic worktree cleanup")}>
                  <SelectValue>
                    {mixedModes
                      ? t3T("Mixed")
                      : mode === "inherit"
                        ? t3T("Inherit")
                        : mode === "off"
                          ? t3T("Off")
                          : t3T("Custom")}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  <SelectItem value="inherit">{t3T("Inherit")}</SelectItem>
                  <SelectItem value="off">{t3T("Off")}</SelectItem>
                  <SelectItem value="custom">{t3T("Custom")}</SelectItem>
                </SelectPopup>
              </Select>
            }
          />
        )}
        {(!isProjectScope || (!mixedModes && mode === "custom")) && (
          <>
            <SettingsRow
              title={t3T("Delete worktrees with deleted threads")}
              status={ruleStatus("worktreeOnDelete")}
              description={t3T(
                "Remove unused worktrees when active or archived threads are deleted. Worktrees with local changes are kept.",
              )}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={t3T("Delete worktrees with deleted threads")}
                  checked={settings.worktreeOnDelete}
                  onCheckedChange={(worktreeOnDelete) => updateWorktree({ worktreeOnDelete })}
                />
              }
            />
            <SettingsRow
              title={t3T("Delete inactive worktrees")}
              status={ruleStatus("worktreeAfterDays")}
              description={t3T(
                "Remove worktrees after their threads have been inactive for this many days. Branches and thread history are kept.",
              )}
              serverScoped={!isProjectScope}
              control={
                <RetentionControl
                  label={t3T("Delete inactive worktrees")}
                  value={settings.worktreeAfterDays}
                  onChange={(worktreeAfterDays) => updateWorktree({ worktreeAfterDays })}
                />
              }
            />
            <SettingsRow
              title={t3T("Delete merged worktrees")}
              status={ruleStatus("worktreeOnMerge")}
              description={t3T(
                "Remove worktrees whose pull request is merged and whose commits are included in the default branch.",
              )}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={t3T("Delete merged worktrees")}
                  checked={settings.worktreeOnMerge}
                  onCheckedChange={(worktreeOnMerge) => updateWorktree({ worktreeOnMerge })}
                />
              }
            />
            <SettingsRow
              title={t3T("Delete unchanged worktrees")}
              status={ruleStatus("worktreeUnchanged")}
              description={t3T("Remove worktrees with no commits beyond the default branch.")}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={t3T("Delete unchanged worktrees")}
                  checked={settings.worktreeUnchanged}
                  onCheckedChange={(worktreeUnchanged) => updateWorktree({ worktreeUnchanged })}
                />
              }
            />
          </>
        )}
      </SettingsSection>

      {!isProjectScope && (
        <SettingsSection id="storage-artifacts" title={t3T("Artifacts and logs")}>
          <SettingsRow
            title={t3T("Delete old browser artifacts")}
            status={ruleStatus("browserArtifactsAfterDays")}
            description={t3T(
              "Delete saved browser captures after this many days. Older capture links will no longer open.",
            )}
            serverScoped
            control={
              <RetentionControl
                label={t3T("Delete old browser artifacts")}
                value={settings.browserArtifactsAfterDays}
                onChange={(browserArtifactsAfterDays) => update({ browserArtifactsAfterDays })}
              />
            }
          />
          <SettingsRow
            title={t3T("Delete old rotated logs")}
            status={ruleStatus("logsAfterDays")}
            description={t3T(
              "Delete inactive rotated log files after this many days. Current logs are kept.",
            )}
            serverScoped
            control={
              <RetentionControl
                label={t3T("Delete old rotated logs")}
                value={settings.logsAfterDays}
                onChange={(logsAfterDays) => update({ logsAfterDays })}
              />
            }
          />
        </SettingsSection>
      )}
    </SettingsPageContainer>
  );
}
