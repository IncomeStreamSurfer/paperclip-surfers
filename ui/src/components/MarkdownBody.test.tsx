// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildAgentMentionHref, buildProjectMentionHref } from "@paperclipai/shared";
import { ThemeProvider } from "../context/ThemeContext";
import { ColorSchemaProvider } from "../context/ColorSchemaContext";
import { MarkdownBody } from "./MarkdownBody";

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ColorSchemaProvider>{children}</ColorSchemaProvider>
    </ThemeProvider>
  );
}

describe("MarkdownBody", () => {
  it("renders markdown images without a resolver", () => {
    const html = renderToStaticMarkup(
      <Wrapper>
        <MarkdownBody>{"![](/api/attachments/test/content)"}</MarkdownBody>
      </Wrapper>,
    );

    expect(html).toContain('<img src="/api/attachments/test/content" alt=""/>');
  });

  it("resolves relative image paths when a resolver is provided", () => {
    const html = renderToStaticMarkup(
      <Wrapper>
        <MarkdownBody resolveImageSrc={(src) => `/resolved/${src}`}>
          {"![Org chart](images/org-chart.png)"}
        </MarkdownBody>
      </Wrapper>,
    );

    expect(html).toContain('src="/resolved/images/org-chart.png"');
    expect(html).toContain('alt="Org chart"');
  });

  it("renders agent and project mentions as chips", () => {
    const html = renderToStaticMarkup(
      <Wrapper>
        <MarkdownBody>
          {`[@CodexCoder](${buildAgentMentionHref("agent-123", "code")}) [@Paperclip App](${buildProjectMentionHref("project-456", "#336699")})`}
        </MarkdownBody>
      </Wrapper>,
    );

    expect(html).toContain('href="/agents/agent-123"');
    expect(html).toContain('data-mention-kind="agent"');
    expect(html).toContain("--paperclip-mention-icon-mask");
    expect(html).toContain('href="/projects/project-456"');
    expect(html).toContain('data-mention-kind="project"');
    expect(html).toContain("--paperclip-mention-project-color:#336699");
  });
});
