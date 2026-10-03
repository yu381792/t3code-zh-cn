# Interface language catalogs

English remains the default. The persisted client-only interfaceLanguage setting accepts en and zh-CN. Web/Electron switches live; native application menus follow the setting.

## One catalog source

- packages/shared/src/i18n/locales/en.json: exact authored English UI source keys.
- packages/shared/src/i18n/locales/zh-CN.json: Simplified Chinese translations.
- @t3tools/shared/i18n: pure, prototype-safe lookup and numbered interpolation; no React/Electron or mutable locale state.
- apps/web/src/i18n/translate.ts: React subscription and active client locale.

Maintain matching JSON key sets. Use complete sentences with numbered slots, never translated prefix/suffix fragments. Values are inserted after translation. Preserve model/provider IDs, paths, commands, URLs, user project names and conversation content. Missing translations fall back to the English source. Call translation only at display boundaries. Narrow authored templates and registered built-in menu IDs protect arbitrary user content. Adding a locale requires explicit catalog registration, schema and setting labels; it must not change the default.

## Verification

Run node scripts/check-interface-localization.mjs and node --test scripts/interface-localization-catalogs.test.mjs. Run focused shared locale, Web i18n/settings/timestamps, and Electron menu/client-settings tests with Vite+. Tests cover selected-value semantics, rendered toast actions, desktop bridge menu payloads, hot switching and inserted values.

## Scope

Web/Electron UI only. React Native can deserialize the defaulted preference but its UI is not translated here. No server-orchestration, DSH, packaging, signing, update-feed, provider-addition or release-version changes.
