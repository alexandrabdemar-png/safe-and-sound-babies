import { registerPlugin } from "@capacitor/core";
import type { AppleIAPPlugin } from "./definitions";

const AppleIAP = registerPlugin<AppleIAPPlugin>("AppleIAP", {
  web: () => import("./web").then((m) => new m.AppleIAPWeb()),
});

export * from "./definitions";
export { AppleIAP };
