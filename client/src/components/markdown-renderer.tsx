import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

import { useTheme } from "@/context/theme-provider";
import { useEffect } from "react";

type Props = {
  markdown: string;
  className?: string;
};

const HLJS_LIGHT = new URL("highlight.js/styles/github.css", import.meta.url)
  .href;
const HLJS_DARK = new URL("highlight.js/styles/xt256.css", import.meta.url)
  .href;

export default function MarkdownRenderer({ markdown, className }: Props) {
  const { isDark } = useTheme();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const id = "hljs-theme";
    let linkEl = document.getElementById(id) as HTMLLinkElement | null;

    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.id = id;
      linkEl.rel = "stylesheet";
      document.head.appendChild(linkEl);
    }

    const nextHref = isDark ? HLJS_DARK : HLJS_LIGHT;
    if (linkEl.href !== nextHref) {
      linkEl.href = nextHref;
    }
  }, [isDark]);

  return (
    <div className={`prose max-w-none dark:prose-invert ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
