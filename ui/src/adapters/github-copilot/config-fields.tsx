import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function GitHubCopilotConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
}: AdapterConfigFieldsProps) {
  const model = isCreate
    ? (values!.model ?? "")
    : eff("adapterConfig", "model", String(config.model ?? ""));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Uses your GitHub Copilot subscription via the{" "}
        <code className="font-mono bg-muted px-1 rounded">gh</code> CLI token (
        <code className="font-mono bg-muted px-1 rounded">gh auth login</code>). No API key required.
      </p>
      <Field label="Model" hint="GitHub Copilot model to use (e.g. gpt-4o, claude-sonnet-4-5).">
        {models.length > 0 ? (
          <select
            className={inputClass}
            value={model}
            onChange={(e) =>
              isCreate
                ? set!({ model: e.target.value })
                : mark("adapterConfig", "model", e.target.value || undefined)
            }
          >
            <option value="">— select model —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        ) : (
          <DraftInput
            value={model}
            onCommit={(v) =>
              isCreate ? set!({ model: v }) : mark("adapterConfig", "model", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="gpt-4o"
          />
        )}
      </Field>
    </div>
  );
}
