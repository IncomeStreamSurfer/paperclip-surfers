import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { companySkillsApi } from "../api/companySkills";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Search, Package } from "lucide-react";

interface AgentSkillSelectorProps {
  companyId: string;
  selectedSkills: string[];
  onSave: (skills: string[]) => void;
  saving?: boolean;
}

export function AgentSkillSelector({
  companyId,
  selectedSkills,
  onSave,
  saving = false,
}: AgentSkillSelectorProps) {
  const [search, setSearch] = useState("");
  const [localSelection, setLocalSelection] = useState<string[]>(selectedSkills);

  const skillsQuery = useQuery({
    queryKey: queryKeys.companySkills.list(companyId),
    queryFn: () => companySkillsApi.list(companyId),
  });

  const skills = skillsQuery.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)),
    );
  }, [skills, search]);

  const deduplicated = useMemo(() => {
    const seen = new Set<string>();
    return filtered.filter((skill) => {
      if (seen.has(skill.key)) return false;
      seen.add(skill.key);
      return true;
    });
  }, [filtered]);

  function toggleSkill(skillKey: string) {
    setLocalSelection((prev) =>
      prev.includes(skillKey) ? prev.filter((s) => s !== skillKey) : [...prev, skillKey],
    );
  }

  const hasChanges =
    localSelection.length !== selectedSkills.length ||
    !localSelection.every((s) => selectedSkills.includes(s));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {localSelection.length} skill{localSelection.length !== 1 ? "s" : ""} selected
        </p>
        <Button
          size="sm"
          onClick={() => onSave(localSelection)}
          disabled={!hasChanges || saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="pl-8 h-9 text-sm"
        />
      </div>

      {deduplicated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">
            {skills.length === 0
              ? "No skills available. Add skills in company settings."
              : "No skills match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {deduplicated.map((skill) => {
            const isSelected = localSelection.includes(skill.key);
            return (
              <Card
                key={skill.id ?? skill.key}
                className={`p-3 cursor-pointer transition-colors hover:bg-muted/30 ${
                  isSelected ? "border-primary/50 bg-primary/5" : ""
                }`}
                onClick={() => toggleSkill(skill.key)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSkill(skill.key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">{skill.name}</h4>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {skill.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 font-mono mt-0.5 truncate">
                      {skill.key}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
