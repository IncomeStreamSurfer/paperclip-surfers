import { useQuery } from "@tanstack/react-query";
import { departmentsApi } from "../api/departments";
import { queryKeys } from "../lib/queryKeys";

interface Props {
  companyId: string;
  departmentId: string | null;
  sharedWith: string[];
  onChange: (update: { departmentId: string | null; sharedWith: string[] }) => void;
}

export function DeptScopeSelector({ companyId, departmentId, sharedWith, onChange }: Props) {
  const { data } = useQuery({
    queryKey: queryKeys.departments.list(companyId),
    queryFn: () => departmentsApi.list(companyId),
  });
  const departments = data?.departments ?? [];

  if (departments.length === 0) return null;

  const mode: "company" | "dept" | "shared" = departmentId
    ? "dept"
    : sharedWith.length > 0
    ? "shared"
    : "company";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">Visibility</label>
      <div className="flex gap-2">
        {(["company", "dept", "shared"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              mode === m
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
            onClick={() => {
              if (m === "company") onChange({ departmentId: null, sharedWith: [] });
              else if (m === "dept") onChange({ departmentId: departments[0]?.id ?? null, sharedWith: [] });
              else onChange({ departmentId: null, sharedWith: sharedWith.length ? sharedWith : departments.slice(0, 1).map((d) => d.id) });
            }}
          >
            {m === "company" ? "Company-wide" : m === "dept" ? "One department" : "Shared with"}
          </button>
        ))}
      </div>

      {mode === "dept" && (
        <select
          className="text-sm px-3 py-1.5 border border-border rounded bg-background focus:outline-none"
          value={departmentId ?? ""}
          onChange={(e) => onChange({ departmentId: e.target.value || null, sharedWith: [] })}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}

      {mode === "shared" && (
        <div className="flex flex-col gap-1">
          {departments.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sharedWith.includes(d.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...sharedWith, d.id]
                    : sharedWith.filter((id) => id !== d.id);
                  onChange({ departmentId: null, sharedWith: next });
                }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full border border-border"
                style={{ backgroundColor: d.color ?? "var(--muted)" }}
              />
              {d.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
