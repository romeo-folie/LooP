import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

import "highlight.js/styles/xt256.css";

type Props = {
  markdown: string;
  className?: string;
};

export default function MarkdownRenderer({ markdown, className }: Props) {
  return (
    <div className={`prose max-w-none dark:prose-invert ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins={[rehypeHighlight as any]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
