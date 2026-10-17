import { readdirSync } from "node:fs";
import path from "node:path";

import hooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const owners = [
  "app",
  "core",
  "study",
  "competencies",
  "engine",
  "recovery",
  "session",
  "presentation",
  "platform",
  "assets",
];

// Only the two stable Hooks invariants are selected; the plugin's compiler
// preset also contains experimental React Compiler checks.
const hookRules = {
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "error",
};

const forbidden = {
  core: [
    "study",
    "competencies",
    "engine",
    "recovery",
    "session",
    "presentation",
    "platform",
    "app",
  ],
  study: [
    "competencies",
    "engine",
    "recovery",
    "session",
    "presentation",
    "platform",
    "app",
  ],
  competencies: [
    "study",
    "engine",
    "recovery",
    "session",
    "presentation",
    "platform",
    "app",
  ],
  engine: ["recovery", "session", "presentation", "platform", "app"],
  recovery: ["session", "presentation", "platform", "app"],
  session: ["presentation", "platform", "app"],
  presentation: ["recovery", "session", "platform", "app"],
  platform: [
    "study",
    "competencies",
    "engine",
    "recovery",
    "session",
    "presentation",
    "app",
  ],
};

const forbiddenPackages = {
  core: ["react", "react-dom", "@xstate/react", "xstate", "@capacitor/"],
  study: ["react", "react-dom", "@xstate/react", "xstate", "@capacitor/"],
  competencies: [
    "react",
    "react-dom",
    "@xstate/react",
    "xstate",
    "@capacitor/",
  ],
  engine: ["react", "react-dom", "@xstate/react", "@capacitor/"],
  recovery: ["react", "react-dom", "@xstate/react", "@capacitor/"],
  session: ["react", "react-dom", "@xstate/react", "@capacitor/"],
  presentation: ["@capacitor/"],
};

const forbiddenPeers = [
  "c01-gross-income",
  "c02-net-pay",
  "c03-overtime-pay",
  "c04-percentage-change",
  "c05-wage-salary",
  "c06-commission",
];

const escape = (value) => value.replace(/\./g, "\\.");
const root = path.resolve(import.meta.dirname, "src");
const testOnly = {
  regex: "^(?:@/|(?:\\.\\./)+(?:src/)?)(?:tests|scripts)(?:/|$)",
  message: "Production must not import tests or scripts.",
};

function relativePattern(from, to) {
  return path.posix
    .relative(from, to)
    .split("/")
    .map((segment) => (segment === ".." ? "\\.\\." : escape(segment)))
    .join("/");
}

function directories(directory) {
  return [
    directory,
    ...readdirSync(path.join(root, directory), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => directories(`${directory}/${entry.name}`)),
  ];
}

// P10-T027 Stage D exception: exact importer and public targets only.
const stageDImporter = "src/engine/activity-machine/public.test.ts";
const stageDPublicTargets = [
  "study/competencies/c04/public",
  "competencies/c04-percentage-change/model/public",
  "competencies/c04-percentage-change/evaluators/public",
];

// P10-T027 Stage E: one production composition root; no private targets.
const stageEPublicTargets = [
  ...stageDPublicTargets,
  "competencies/c04-percentage-change/completion/public",
];

function restriction(directory, publicTargets = [], extraPatterns = []) {
  const [owner, module] = directory.split("/");
  const disallowed = [...(forbidden[owner] ?? [])];
  if (owner === "competencies" && forbiddenPeers.includes(module)) {
    disallowed.push(
      ...forbiddenPeers
        .filter((peer) => peer !== module)
        .map((peer) => `competencies/${peer}`),
    );
  }

  const patterns = [
    testOnly,
    ...extraPatterns,
    {
      regex: "^@/(?:src/|(?:[^/]+/)*\\.\\./)",
      message: "Use the single canonical @/ source alias.",
    },
    {
      regex: "^(?:\\./|\\.\\./)*(?:[^/]+/)*[^./][^/]*/\\.\\./",
      message:
        "Use canonical relative paths without interior parent traversal.",
    },
  ];

  for (const pkg of forbiddenPackages[owner] ?? []) {
    patterns.push({
      regex: `^${escape(pkg)}${pkg.endsWith("/") ? "" : "(?:/|$)"}`,
      message: `${owner} must not import ${pkg}.`,
    });
  }

  for (const target of disallowed) {
    const relative = relativePattern(directory, target);
    patterns.push({
      regex: `^(?:@/${escape(target)}|(?:\\./)?${relative})(?:/|$)`,
      message: `${owner} must not import ${target}.`,
    });
  }

  // Cross-owner imports must use their public.ts contract. The root app
  // bootstrap is deliberately exempt from this policy.
  if (owner !== "app") {
    for (const target of owners.filter(
      (item) => item !== owner && !disallowed.includes(item),
    )) {
      const relative = relativePattern(directory, target);
      const allowed = publicTargets
        .filter((entry) => entry.startsWith(`${target}/`))
        .map((entry) => `${escape(entry.slice(target.length + 1))}(?:\\.ts)?$`);
      patterns.push({
        regex: `^(?:@/${escape(target)}|(?:\\./)?${relative})/(?!public(?:\\.ts)?$${allowed.length ? `|${allowed.join("|")}` : ""})`,
        message: `Import ${target}/public.ts instead of its internals.`,
      });
    }
  }

  return {
    files: [`src/${directory}/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": ["error", { patterns }],
    },
  };
}

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
  })),
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      ...hookRules,
      "no-restricted-imports": [
        "error",
        {
          patterns: [testOnly],
        },
      ],
    },
  },
  ...owners
    .filter((owner) =>
      readdirSync(root, { withFileTypes: true }).some(
        (entry) => entry.name === owner && entry.isDirectory(),
      ),
    )
    .flatMap(directories)
    .map((directory) => restriction(directory)),
  {
    ...restriction("engine/activity-machine", stageDPublicTargets),
    files: [stageDImporter],
  },
  {
    ...restriction("engine/c04-activity-binding", stageEPublicTargets),
    files: ["src/engine/c04-activity-binding/public.ts"],
  },
  {
    ...restriction(
      "engine/c04-activity-binding",
      stageDPublicTargets.slice(0, 2),
    ),
    files: ["src/engine/c04-activity-binding/public.test.ts"],
  },
  // P10-D177/S1: exact production consumers, never a directory grant.
  {
    ...restriction("recovery/projection", [
      "engine/activity-machine/public",
      "engine/activity-runtime/public",
      "engine/c04-activity-binding/public",
    ]),
    files: ["src/recovery/projection/public.ts"],
  },
  {
    ...restriction("recovery/checkpoint", ["study/revision/public"]),
    files: [
      "src/recovery/checkpoint/public.ts",
      "src/recovery/checkpoint/public.test.ts",
    ],
  },
  // Exact T029 test consumer, not a directory grant.
  {
    ...restriction("recovery/projection", [
      "engine/c04-activity-binding/public",
    ]),
    files: ["src/recovery/projection/public.test.ts"],
  },
  // D177/S3: only the actually consumed C04 source-composition facade.
  {
    ...restriction("recovery/rehydration", [
      "engine/c04-activity-binding/public",
    ]),
    files: ["src/recovery/rehydration/public.ts"],
  },
  {
    ...restriction("recovery/rehydration", [
      "engine/c04-activity-binding/public",
    ]),
    files: ["src/recovery/rehydration/public.test.ts"],
  },
  // D177/S4: only the exact Session composition consumers and used targets.
  {
    ...restriction("session/app-machine", [
      "engine/c04-activity-binding/public",
      "recovery/rehydration/public",
      "study/catalog/public",
    ]),
    files: ["src/session/app-machine/public.ts"],
  },
  {
    ...restriction("session/app-machine", [
      "engine/c04-activity-binding/public",
      "recovery/rehydration/public",
      "study/catalog/public",
    ]),
    files: ["src/session/app-machine/public.test.ts"],
  },
  // D177/S5: the two actually used T033 test collaborators only.
  {
    ...restriction(
      "session/navigation",
      ["study/catalog/public", "engine/activity-machine/public"],
      [
        {
          regex: "^\\.\\./\\.\\./(?:engine|study)/",
          message:
            "D177/S5 test collaborators use their exact @/ public targets.",
        },
      ],
    ),
    files: ["src/session/navigation/public.test.ts"],
  },
);
