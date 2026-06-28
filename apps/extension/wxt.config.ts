import { defineConfig } from "wxt";

export default defineConfig({
  // Narrow the set of build targets (also types `import.meta.env.BROWSER`).
  targetBrowsers: ["chrome", "firefox", "safari"],

  manifest: ({ browser }) => ({
    name: "vibeste.rs",
    short_name: "vibeste.rs",
    description:
      "Hide the vibecoding tag and mute vibecoding comment threads on lobste.rs.",

    // Minimal permissions: settings storage only. No host_permissions, no tabs,
    // no background worker, no network access. The content-script `matches`
    // (see entrypoints/lobsters.content.ts) grant everything we need.
    permissions: ["storage"],

    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },

    // Firefox requires an explicit add-on id. It is also required for
    // `storage.sync` to actually persist on Firefox — so this is functional,
    // not just a signing detail.
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "vibeste-rs@norbauer.com",
              strict_min_version: "115.0",
              // We collect nothing. Declaring this explicitly satisfies AMO's
              // data-collection requirement and silences the build warning.
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : {}),
  }),

  zip: {
    // Firefox/AMO wants a reproducible sources zip alongside the build.
    zipSources: true,
    sourcesTemplate: "{{name}}-{{version}}-sources.zip",
  },
});
