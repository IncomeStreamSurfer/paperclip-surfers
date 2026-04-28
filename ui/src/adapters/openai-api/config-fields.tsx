import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function OpenAIApiConfigFields({
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
  const baseUrl = isCreate
    ? (values!.baseUrl ?? "")
    : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? ""));

  return (
    <div className="flex flex-col gap-3">
      <Field label="API Key" hint="Your OpenAI API key (sk-...). Stored in adapterConfig — consider using a secret reference.">
        <DraftInput
          value={apiKey}
          onCommit={(v) =>
            isCreate ? set!({ apiKey: v }) : mark("adapterConfig", "apiKey", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="sk-..."
        />
      </Field>
      <Field label="Model" hint="Model ID to use (e.g. gpt-4o, gpt-4-turbo).">
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
      <Field label="Base URL (optional)" hint="Override the OpenAI API base URL. Leave blank for the default (https://api.openai.com/v1).">
        <DraftInput
          value={baseUrl}
          onCommit={(v) =>
            isCreate ? set!({ baseUrl: v }) : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="https://api.openai.com/v1"
        />
      </Field>
    </div>
  );
}
