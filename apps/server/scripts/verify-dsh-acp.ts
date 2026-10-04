import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  AcpRegistryProbeResult,
  AcpRegistrySettings,
  ProviderInstanceId,
} from "@t3tools/contracts";
import { fromJsonStringPretty } from "@t3tools/shared/schemaJson";
import {
  HostProcessArchitecture,
  HostProcessEnvironment,
  HostProcessPlatform,
} from "@t3tools/shared/hostProcess";
import * as Effect from "effect/Effect";
import * as Console from "effect/Console";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/unstable/http";
import {
  makeAcpRegistryCatalog,
  AcpRegistryCatalog,
} from "../src/provider/acp/AcpRegistrySupport.ts";
import { probeAcpRegistryConfiguration } from "../src/provider/acp/AcpRegistryProbe.ts";
const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const cacheDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-dsh-probe-" });
  const catalog = yield* makeAcpRegistryCatalog({ cacheDir, toolsDir: `${cacheDir}/tools` });
  const settings = yield* Schema.decodeEffect(AcpRegistrySettings)({
    agentId: "",
    commandPath: new URL("../../../local/dsh/t3-dsh-acp", import.meta.url).pathname,
  });
  const result = yield* probeAcpRegistryConfiguration({
    instanceId: ProviderInstanceId.make("dsh"),
    settings,
    cwd: process.cwd(),
    environment: process.env,
  }).pipe(Effect.provideService(AcpRegistryCatalog, catalog));
  yield* Console.log(
    yield* Schema.encodeEffect(fromJsonStringPretty(AcpRegistryProbeResult))(result.probe),
  );
}).pipe(
  Effect.scoped,
  Effect.provide(
    Layer.mergeAll(
      NodeServices.layer,
      Layer.succeed(HostProcessPlatform, process.platform),
      Layer.succeed(HostProcessArchitecture, process.arch),
      Layer.succeed(HostProcessEnvironment, process.env),
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.die("Local ACP must not fetch a registry")),
      ),
    ),
  ),
);
await Effect.runPromise(main);
