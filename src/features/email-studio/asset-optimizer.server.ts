import "server-only";

import sharp from "sharp";

export type OptimizedEmailAsset = {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
  width: number;
  height: number;
  optimized: true;
};

export async function optimizeEmailAsset(
  input: Buffer,
  mimeType: string,
): Promise<OptimizedEmailAsset> {
  const pipeline = sharp(input, {
    animated: false,
    failOn: "warning",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({
      width: 1400,
      withoutEnlargement: true,
      fit: "inside",
    });

  const hasAlpha = (await pipeline.metadata()).hasAlpha === true;
  const output =
    hasAlpha || mimeType === "image/png"
      ? await pipeline
          .png({ compressionLevel: 9, palette: true, quality: 90 })
          .toBuffer({ resolveWithObject: true })
      : await pipeline
          .jpeg({ quality: 86, progressive: true, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });

  if (!output.info.width || !output.info.height) {
    throw new Error("No fue posible obtener las dimensiones del asset.");
  }

  const isPng = output.info.format === "png";
  return {
    buffer: output.data,
    mimeType: isPng ? "image/png" : "image/jpeg",
    extension: isPng ? "png" : "jpg",
    width: output.info.width,
    height: output.info.height,
    optimized: true,
  };
}
