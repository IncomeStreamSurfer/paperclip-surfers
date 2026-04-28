#!/usr/bin/env python3
"""
Replace native HTML title= attributes with custom Tooltip components
in UI component files. Conservative: only handles clear button/icon cases.
"""

import re
import sys
from pathlib import Path

COMPONENTS_DIR = Path("/home/ccasalicchio/paperclip-surfers/ui/src/components")

IMPORT_LINE = '''import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";\n'''

# Files to process (relative to COMPONENTS_DIR)
FILES = [
    "Sidebar.tsx",
    "Layout.tsx",
    "IssuesList.tsx",
    "KanbanBoard.tsx",
    "ActiveAgentsPanel.tsx",
    "CommentThread.tsx",
    "IssueProperties.tsx",
    "AgentConfigForm.tsx",
    "HeaderClock.tsx",
    "WidgetCustomizePanel.tsx",
    "ColorPicker.tsx",
    "SidebarProjects.tsx",
    "SidebarAgents.tsx",
    "IssueRow.tsx",
    "AvatarGeneratorPanel.tsx",
    "SidebarNavItem.tsx",
    "NewIssueDialog.tsx",
    "AgentIconPicker.tsx",
    "IssueDocumentsSection.tsx",
    "IssueWorkspaceCard.tsx",
]

# Regex to find title= on element opening tags (not on custom components)
# Matches: title="..." or title={...} on <button, <div, <span, <a, <label, <input, <svg
# Group 1: element name
# Group 2: everything before title
# Group 3: title value (with quotes or braces)
# Group 4: everything after title
# Group 5: rest of tag including >
TITLE_RE = re.compile(
    r'(<(button|div|span|a|label|input|svg|li|nav|header|footer|section|article|aside|main|figure|figcaption|time|mark|small|strong|em|i|b|u|s|del|ins|sub|sup|code|pre|kbd|samp|var|abbr|address|cite|q|blockquote|dfn|data|meter|progress|ruby|rt|rp|wbr|bdi|bdo|details|summary|dialog|canvas|video|audio|source|track|embed|object|param|iframe|map|area|form|fieldset|legend|datalist|optgroup|option|textarea|select|output|table|thead|tbody|tfoot|tr|td|th|col|colgroup|caption)(?:\s+[^>]*)?)\s+title=("[^"]*"|\{[^}]*\})(\s+[^>]*)?(/?>)',
    re.IGNORECASE,
)

def has_truncate(content: str) -> bool:
    return 'truncate' in content

def already_has_tooltip_import(content: str) -> bool:
    return '@components/ui/tooltip' in content or 'from "@/components/ui/tooltip"' in content

def wrap_with_tooltip(tag_before: str, title_value: str, tag_after: str, close: str) -> str:
    """Wrap the element in a Tooltip."""
    # Strip quotes from title value
    if title_value.startswith('"') and title_value.endswith('"'):
        tooltip_text = title_value[1:-1]
    elif title_value.startswith('{') and title_value.endswith('}'):
        tooltip_text = title_value[1:-1]
    else:
        tooltip_text = title_value
    
    # Reconstruct the element without title
    element = f"{tag_before}{tag_after or ''}{close}"
    
    # If the element is self-closing or a simple tag, wrap it
    # Use dangerouslySetInnerHTML approach won't work well for JSX
    # Instead, we'll return the tooltip-wrapped version
    return f'''<Tooltip>
  <TooltipTrigger asChild>
    {element.strip()}
  </TooltipTrigger>
  <TooltipContent side="top" className="text-xs">{tooltip_text}</TooltipContent>
</Tooltip>'''

def process_file(path: Path) -> tuple[str, int]:
    content = path.read_text()
    original = content
    replacements = 0
    
    # Skip files that don't have title= on native elements
    if 'title=' not in content:
        return content, 0
    
    # Add import if needed
    needs_import = not already_has_tooltip_import(content)
    
    # Find all matches and replace from end to start to preserve positions
    matches = list(TITLE_RE.finditer(content))
    
    for m in reversed(matches):
        full_tag = m.group(0)
        tag_before = m.group(1)
        tag_after = m.group(4) or ''
        close = m.group(5)
        title_value = m.group(3)
        
        # Skip if inside a truncate element (check broader context)
        context_start = max(0, m.start() - 200)
        context = content[context_start:m.start()]
        if has_truncate(context) and 'truncate' in tag_before:
            continue
        
        # Skip if already inside a Tooltip
        before_text = content[:m.start()]
        if '<Tooltip>' in before_text.split('\n')[-10:] or '<TooltipTrigger' in before_text.split('\n')[-10:]:
            continue
        
        # For simple self-closing or single-line elements, do the replacement
        element_start = m.start()
        element_end = m.end()
        
        # Find the full element (may span multiple lines)
        # For our cases, most are single-line buttons/spans
        if '\n' in full_tag:
            continue  # Skip multi-line for safety
        
        # Simple replacement: remove title, wrap in Tooltip
        stripped_tag = f"{tag_before}{tag_after}{close}"
        
        tooltip_text = title_value.strip('"{}')
        replacement = f'<Tooltip><TooltipTrigger asChild>{stripped_tag}</TooltipTrigger><TooltipContent side="top" className="text-xs">{tooltip_text}</TooltipContent></Tooltip>'
        
        content = content[:element_start] + replacement + content[element_end:]
        replacements += 1
    
    if replacements > 0 and needs_import:
        # Add import after the last import line
        lines = content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('import{'):
                last_import_idx = i
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, IMPORT_LINE.rstrip())
            content = '\n'.join(lines)
    
    return content, replacements

def main():
    total = 0
    for fname in FILES:
        path = COMPONENTS_DIR / fname
        if not path.exists():
            print(f"Skip (not found): {fname}")
            continue
        new_content, count = process_file(path)
        if count > 0:
            path.write_text(new_content)
            print(f"Replaced {count} title(s) in {fname}")
            total += count
        else:
            print(f"No changes in {fname}")
    print(f"\nTotal replacements: {total}")

if __name__ == "__main__":
    main()
