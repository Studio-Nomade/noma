import { z } from "zod";

const uuid = z.string().uuid();

const snapshotElementSchema = z.object({
  id: uuid,
  type: z.enum(["image", "text", "button", "spacer", "template"]),
  position: z.number().int().min(0),
  assetId: uuid.nullable(),
  templateId: uuid.nullable(),
  label: z.string(),
  content: z.string().nullable(),
  href: z.string().nullable(),
  alt: z.string(),
  align: z.enum(["left", "center", "right"]),
  fontSize: z.number().int(),
  color: z.string(),
  backgroundColor: z.string(),
  padding: z.string(),
});

const snapshotVariableSchema = z.object({
  id: uuid,
  key: z.string(),
  label: z.string(),
  sample: z.string(),
  required: z.boolean(),
});

export const emailStudioEditorSnapshotSchema = z.object({
  settings: z.object({
    subject: z.string(),
    previewText: z.string(),
    emailWidth: z.number().int(),
    canvasColor: z.string(),
    bodyColor: z.string(),
    textColor: z.string(),
  }),
  elements: z.array(snapshotElementSchema),
  variables: z.array(snapshotVariableSchema),
});

export type EmailStudioEditorSnapshot = z.infer<
  typeof emailStudioEditorSnapshotSchema
>;

type SnapshotInput = {
  project: EmailStudioEditorSnapshot["settings"];
  elements: Array<{
    id: string;
    type: string;
    position: number;
    assetId: string | null;
    templateId: string | null;
    label: string;
    content: string | null;
    href: string | null;
    alt: string;
    align: string;
    fontSize: number;
    color: string;
    backgroundColor: string;
    padding: string;
  }>;
  variables: Array<{
    id: string;
    key: string;
    label: string;
    sample: string;
    required: boolean;
  }>;
};

export function createEmailStudioEditorSnapshot(
  input: SnapshotInput,
): EmailStudioEditorSnapshot {
  return emailStudioEditorSnapshotSchema.parse({
    settings: {
      subject: input.project.subject,
      previewText: input.project.previewText,
      emailWidth: input.project.emailWidth,
      canvasColor: input.project.canvasColor,
      bodyColor: input.project.bodyColor,
      textColor: input.project.textColor,
    },
    elements: input.elements.map((element) => ({
      id: element.id,
      type: element.type,
      position: element.position,
      assetId: element.assetId,
      templateId: element.templateId,
      label: element.label,
      content: element.content,
      href: element.href,
      alt: element.alt,
      align: element.align,
      fontSize: element.fontSize,
      color: element.color,
      backgroundColor: element.backgroundColor,
      padding: element.padding,
    })),
    variables: input.variables.map((variable) => ({
      id: variable.id,
      key: variable.key,
      label: variable.label,
      sample: variable.sample,
      required: variable.required,
    })),
  });
}
