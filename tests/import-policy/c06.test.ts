import { beforeAll, describe, expect, it } from "vitest";
import { ESLint, Linter } from "eslint";
const installedPolicy = new ESLint();

/** Exercise installed policy without parser-program file membership obscuring import diagnostics. */
async function denied(file: string, target: string, typeOnly = false) {
  const config = await installedPolicy.calculateConfigForFile(file);
  const linter = new Linter();
  if (!config?.rules?.["no-restricted-imports"])
    throw new Error(`Missing installed policy for ${file}`);
  const messages = linter.verify(
    `import ${typeOnly ? "type " : ""}{ Probe } from "${target}";`,
    [
      {
        languageOptions: {
          parser: config.languageOptions.parser,
          parserOptions: { sourceType: "module" },
        },
        rules: {
          "no-restricted-imports": config.rules["no-restricted-imports"],
        },
      },
    ],
  );
  if (messages.some((m) => m.fatal))
    throw new Error("Import policy probe did not parse");
  return messages.some((m) => m.ruleId === "no-restricted-imports");
}
describe("T057 exact C06 import policy", () => {
  it.each([false, true])(
    "admits only B058-PRODUCTION-003 exact public consumers, typeOnly=%s",
    async (typeOnly) => {
      for (const file of [
        "src/session/app-machine/public.ts",
        "src/app/composition-root.tsx",
      ])
        expect(
          await denied(file, "@/engine/c06-activity-binding/public", typeOnly),
        ).toBe(false);
      for (const file of [
        "src/session/app-machine/other.ts",
        "src/app/other.tsx",
      ])
        expect(
          await denied(file, "@/engine/c06-activity-binding/public", typeOnly),
        ).toBe(true);
      for (const target of [
        "@/engine/c06-activity-binding/private",
        "@/competencies/c06-commission/model/public",
        "@/study/competencies/c06/public",
      ])
        expect(
          await denied("src/app/composition-root.tsx", target, typeOnly),
        ).toBe(true);
    },
  );
  beforeAll(async () => {
    await denied("src/engine/c06-activity-binding/public.ts", "@/core/public");
  }, 30000);
  it.each([false, true])(
    "admits exact production/test targets, typeOnly=%s",
    async (typeOnly) => {
      for (const target of [
        "study/competencies/c06/public",
        "competencies/c06-commission/model/public",
        "competencies/c06-commission/evaluators/public",
      ])
        expect(
          await denied(
            "src/engine/c06-activity-binding/public.ts",
            `@/${target}`,
            typeOnly,
          ),
        ).toBe(false);
      for (const module of ["projection", "checkpoint", "rehydration", "store"])
        expect(
          await denied(
            `src/recovery/${module}/c06.test.ts`,
            "@/engine/c06-activity-binding/public",
            typeOnly,
          ),
        ).toBe(false);
      for (const module of ["projection", "rehydration"])
        expect(
          await denied(
            `src/recovery/${module}/public.ts`,
            "@/engine/c06-activity-binding/public",
            typeOnly,
          ),
        ).toBe(false);
    },
  );
  it.each([false, true])(
    "keeps aliases, relative private targets, peers and unrelated consumers denied, typeOnly=%s",
    async (typeOnly) => {
      const file = "src/engine/c06-activity-binding/public.ts";
      for (const target of [
        "@/study/competencies/c06/content",
        "../../study/competencies/c06/content",
        "@/competencies/c06-commission/model/private",
        "@/study/competencies/c03/public",
        "@/recovery/projection/public",
      ])
        expect(await denied(file, target, typeOnly)).toBe(true);
      expect(
        await denied(
          "src/engine/c06-activity-binding/public.test.ts",
          "@/competencies/c06-commission/evaluators/public",
          typeOnly,
        ),
      ).toBe(true);
      expect(
        await denied(
          "src/engine/activity-machine/public.test.ts",
          "@/study/competencies/c06/public",
          typeOnly,
        ),
      ).toBe(true);
      expect(
        await denied(
          "src/recovery/projection/public.test.ts",
          "@/engine/c06-activity-binding/public",
          typeOnly,
        ),
      ).toBe(true);
      expect(
        await denied(file, "../../study/competencies/c06/public", typeOnly),
      ).toBe(false);
    },
  );
  it("preserves old exact public exceptions and Core restrictions", async () => {
    expect(
      await denied(
        "src/engine/c03-activity-binding/public.ts",
        "@/study/competencies/c03/public",
      ),
    ).toBe(false);
    expect(
      await denied(
        "src/engine/c04-activity-binding/public.ts",
        "@/study/competencies/c04/public",
      ),
    ).toBe(false);
    expect(
      await denied("src/core/public.ts", "@/study/competencies/c06/public"),
    ).toBe(true);
  });
});

describe("T058 B058-IMPORT-001 exact presentation consumers", () => {
  it.each([false, true])(
    "admits only the three authorized consumers, typeOnly=%s",
    async (typeOnly) => {
      for (const name of ["public.tsx", "preview.tsx", "prepare.test.tsx"]) {
        const file = `src/presentation/models/c06-commission-machine/${name}`;
        for (const target of [
          "@/engine/c06-activity-binding/public",
          "../../../engine/c06-activity-binding/public",
        ]) {
          expect(await denied(file, target, typeOnly)).toBe(false);
        }
        for (const target of [
          "@/engine/c06-activity-binding/private",
          "../../../engine/c06-activity-binding/private",
          "@/study/competencies/c06/public",
          "@/competencies/c06-commission/model/public",
          "@/competencies/c06-commission/evaluators/public",
          "@/engine/c03-activity-binding/public",
          "@/recovery/store/public",
        ])
          expect(await denied(file, target, typeOnly)).toBe(true);
      }
      expect(
        await denied(
          "src/presentation/models/c06-commission-machine/unrelated.tsx",
          "@/engine/c06-activity-binding/public",
          typeOnly,
        ),
      ).toBe(true);
    },
  );
});
