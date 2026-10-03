import type {
  ModelSelection,
  ProviderOptionDescriptor,
  ProviderOptionSelection,
  ServerProviderModel,
} from "@t3tools/contracts";
import {
  getProviderOptionCurrentLabel,
  getProviderOptionCurrentValue,
} from "@t3tools/shared/model";
import { useComposerDraftStore } from "../../composerDraftStore";
import { getProviderModelCapabilities } from "../../providerModels";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { type DraftId } from "../../composerDraftStore";
import type { ScopedThreadRef, ProviderDriverKind } from "@t3tools/contracts";
import type { ComposerControlSize } from "./ComposerControl";

export function findSessionPresetDescriptor(
  models: ReadonlyArray<ServerProviderModel>,
  model: string,
  provider: ProviderDriverKind,
): Extract<ProviderOptionDescriptor, { type: "select" }> | undefined {
  return getProviderModelCapabilities(models, model, provider, false).optionDescriptors?.find(
    (option): option is Extract<ProviderOptionDescriptor, { type: "select" }> =>
      option.id === "agent_preset" && option.type === "select",
  );
}

export function SessionPresetPicker(props: {
  target: ScopedThreadRef | DraftId;
  provider: ProviderDriverKind;
  selection: ModelSelection;
  reportedSelection?: ModelSelection | null | undefined;
  descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>;
  disabled: boolean;
  size: ComposerControlSize;
}) {
  const setOptions = useComposerDraftStore((store) => store.setProviderModelOptions);
  const value = getProviderOptionCurrentValue(
    props.descriptor,
    props.selection,
    props.reportedSelection,
  );
  const label = getProviderOptionCurrentLabel(
    props.descriptor,
    props.selection,
    props.reportedSelection,
  );
  return (
    <Select
      value={typeof value === "string" ? value : ""}
      disabled={props.disabled}
      onValueChange={(next) => {
        if (next === null || props.disabled) return;
        const options: ReadonlyArray<ProviderOptionSelection> = [
          ...(props.selection.options ?? []).filter((option) => option.id !== props.descriptor.id),
          { id: props.descriptor.id, value: next },
        ];
        setOptions(props.target, props.provider, options, {
          instanceId: props.selection.instanceId,
          model: props.selection.model,
          persistSticky: true,
        });
      }}
    >
      <SelectTrigger
        size={props.size}
        variant="ghost"
        aria-label="预设"
        title={props.disabled ? "预设已固定；切换请新建对话" : "第一条消息发送前选择预设"}
      >
        <SelectValue>预设 {label}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {props.descriptor.options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
