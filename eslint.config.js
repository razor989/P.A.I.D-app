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

function restriction(directory) {
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
      patterns.push({
        regex: `^(?:@/${escape(target)}|(?:\\./)?${relative})/(?!public(?:\\.ts)?$)`,
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
    .map(restriction),
);
