import { createElement, Fragment, type ReactNode } from "react";
import { act, create, type ReactTestRenderer, type ReactTestInstance } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { DesktopUpdateState } from "@t3tools/contracts";

const testState = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

vi.mock("./ui/toast", () => ({
  toastManager: { add: testState.addToast },
}));

import { showDesktopUpdateDownloadedToast } from "./desktopUpdate.toast";

const renderedDescriptions: ReactTestRenderer[] = [];
const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");

/** Mount the description normally so links can use React hooks. */
async function findReleaseNotesLink(node: ReactNode): Promise<ReactTestInstance | null> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(createElement(Fragment, null, node));
  });
  renderedDescriptions.push(renderer!);
  try {
    return renderer!.root.findAllByType("button")[0] ?? null;
  } catch {
    // A fragment containing only text has no TestInstance root.
    return null;
  }
}

function getDescription(): ReactNode {
  const toast = testState.addToast.mock.calls[0]?.[0] as { description?: ReactNode } | undefined;
  return toast?.description ?? null;
}

function downloadedState(overrides: Partial<DesktopUpdateState> = {}): DesktopUpdateState {
  return {
    enabled: true,
    status: "downloaded",
    channel: "latest",
    currentVersion: "0.0.29",
    hostArch: "arm64",
    appArch: "arm64",
    runningUnderArm64Translation: false,
    availableVersion: "0.0.30",
    downloadedVersion: "0.0.30",
    releaseNotes: [],
    omittedReleaseCount: 0,
    downloadPercent: 100,
    checkedAt: null,
    message: null,
    errorContext: null,
    canRetry: true,
    ...overrides,
  };
}

describe("showDesktopUpdateDownloadedToast", () => {
  beforeEach(() => {
    testState.addToast.mockReset();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(async () => {
    await act(async () => {
      renderedDescriptions.splice(0).forEach((renderer) => renderer.unmount());
    });
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  });

  it("opens the downloaded version's release notes", async () => {
    const openExternal = vi.fn().mockResolvedValue(true);

    showDesktopUpdateDownloadedToast({ openExternal }, downloadedState());
    const link = await findReleaseNotesLink(getDescription());
    link?.props.onClick?.();
    await vi.waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith(
        "https://github.com/pingdotgg/t3code/releases/tag/v0.0.30",
      );
    });
    expect(testState.addToast).toHaveBeenCalledTimes(1);
  });

  it("falls back to the version the download was started for", async () => {
    const openExternal = vi.fn().mockResolvedValue(true);

    // The `update-downloaded` event can land after the download RPC resolves.
    showDesktopUpdateDownloadedToast(
      { openExternal },
      downloadedState({ downloadedVersion: null }),
    );
    (await findReleaseNotesLink(getDescription()))?.props.onClick?.();

    await vi.waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith(
        "https://github.com/pingdotgg/t3code/releases/tag/v0.0.30",
      );
    });
  });

  it("omits the link when the updater reports no version at all", async () => {
    showDesktopUpdateDownloadedToast(
      { openExternal: vi.fn() },
      downloadedState({ availableVersion: null, downloadedVersion: null }),
    );

    expect(await findReleaseNotesLink(getDescription())).toBeNull();
  });

  it.each([
    ["returns false", vi.fn().mockResolvedValue(false)],
    ["rejects", vi.fn().mockRejectedValue(new Error("open failed"))],
  ])("shows an error when opening release notes %s", async (_description, openExternal) => {
    showDesktopUpdateDownloadedToast({ openExternal }, downloadedState());
    (await findReleaseNotesLink(getDescription()))?.props.onClick?.();

    await vi.waitFor(() => {
      expect(testState.addToast).toHaveBeenLastCalledWith({
        type: "error",
        title: "Unable to open release notes",
      });
    });
  });
});
