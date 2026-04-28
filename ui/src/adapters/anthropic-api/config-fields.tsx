import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function AnthropicApiConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
}: AdapterConfigFieldsProps) {
  const apiKey = isCreate
    ? (values!.apiKey ?? "")
    : eff("adapterConfig", "apiKey", String(config.apiKey ?? ""));
  const model = isCreate
    ? (values!.model ?? "")
    : eff("adapterConfig", "model", String(config.model ?? ""));

  return (
    <div className="flex flex-col gap-3">
      <Field label="API Key" hint="Your Anthropic API key (sk-ant-...). Stored in adapterConfig — consider using a secret reference.">
        <DraftInput
          value={apiKey}
          onCommit={(v) =>
            isCreate ? set!({ apiKey: v }) : mark("adapterConfig", "apiKey", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="sk-ant-..."
        />
      </Field>
      <Field label="Model" hint="Model ID to use (e.g. claude-opus-4-5, claude-sonnet-4-5).">
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
            placeholder="claude-opus-4-5"
          />
        )}
      </Field>
    </div>
  );
}
