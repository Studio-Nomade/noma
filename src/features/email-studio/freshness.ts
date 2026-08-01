export function isEmailStudioDocumentCurrent(input: {
  currentDocument: unknown;
  generatedAt: Date | string | null;
  updatedAt: Date | string;
}): boolean {
  if (!input.currentDocument || !input.generatedAt) return false;
  return (
    new Date(input.updatedAt).getTime() <= new Date(input.generatedAt).getTime()
  );
}
