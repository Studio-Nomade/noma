"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading3,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseRichTextDocument, serializeRichTextDocument } from "./rich-text";

export function ServiceRichTextEditor({
  label,
  value,
  onChange,
  legacyMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  legacyMode: "stages" | "deliverables";
  placeholder: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        heading: { levels: [3] },
      }),
    ],
    content: parseRichTextDocument(value, legacyMode),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-52 px-4 py-3 text-sm leading-6 outline-none [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-heading [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
        "aria-label": label,
      },
    },
    onUpdate({ editor: current }) {
      onChange(serializeRichTextDocument(current.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = serializeRichTextDocument(editor.getJSON());
    const incoming = serializeRichTextDocument(
      parseRichTextDocument(value, legacyMode),
    );
    if (current !== incoming) {
      editor.commands.setContent(parseRichTextDocument(value, legacyMode), {
        emitUpdate: false,
      });
    }
  }, [editor, legacyMode, value]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border-border bg-background overflow-hidden rounded-xl border">
        <div
          className="border-border bg-muted/30 flex flex-wrap gap-1 border-b p-2"
          role="toolbar"
          aria-label={`Formato de ${label}`}
        >
          <ToolbarButton
            label="Negrita"
            active={editor?.isActive("bold")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Párrafo"
            active={editor?.isActive("paragraph")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          >
            <Pilcrow className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Subtítulo"
            active={editor?.isActive("heading", { level: 3 })}
            disabled={!editor}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Lista con viñetas"
            active={editor?.isActive("bulletList")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Lista numerada"
            active={editor?.isActive("orderedList")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
          <span className="bg-border mx-1 w-px" aria-hidden />
          <ToolbarButton
            label="Deshacer"
            disabled={!editor?.can().chain().focus().undo().run()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Rehacer"
            disabled={!editor?.can().chain().focus().redo().run()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="size-4" />
          </ToolbarButton>
        </div>
        <div className="relative">
          {!editor?.getText().trim() && (
            <p className="text-muted-foreground pointer-events-none absolute top-3 left-4 text-sm">
              {placeholder}
            </p>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Usa subtítulos, negrita y listas. El mismo formato se conservará en la
        propuesta y el PDF.
      </p>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}
