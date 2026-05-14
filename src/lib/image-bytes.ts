/** PNG / JPEG / WEBP detection from magic bytes only (no trusting Content-Type). */
export function assertAllowedRasterImageBytes(buf: Uint8Array) {
  if (buf.length < 12) throw new Error("File too small to be a valid image.");

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";

  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return "png";
  }

  const riff = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
  if (riff === "RIFF" && webp === "WEBP") return "webp";

  throw new Error("Please upload a PNG, JPG, or WEBP image.");
}
