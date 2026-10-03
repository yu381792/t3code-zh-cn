import { useInterfaceLanguage } from "./translate";
import { translateUiMessage } from "./messages";
/** For confirmed product-defined labels only; never wrap user-provided titles. */
export function LocalizedUiText({ source }: { source: string | null | undefined }) {
  const language = useInterfaceLanguage();
  return translateUiMessage(source, language);
}
