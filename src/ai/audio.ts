import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/**
 * Muse Voice Transcribe accepts only mono 16-bit PCM WAV (16 or 24 kHz).
 * WhatsApp voice notes arrive as OGG/Opus, so convert them first.
 * Equivalent to: ffmpeg -i input -ac 1 -ar 24000 -c:a pcm_s16le -map_metadata -1 output.wav
 */
export async function toTranscribableWav(input: Buffer): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found (ffmpeg-static)");
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath as unknown as string, [
      "-hide_banner", "-loglevel", "error",
      "-i", "pipe:0",
      "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", "-map_metadata", "-1",
      "-f", "wav", "pipe:1",
    ]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ff.stdout.on("data", (d: Buffer) => out.push(d));
    ff.stderr.on("data", (d: Buffer) => err.push(d));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().trim()}`));
    });
    ff.stdin.on("error", () => {}); // ffmpeg may close stdin early on bad input; the close handler reports it
    ff.stdin.end(input);
  });
}

/** True if the buffer is already a RIFF/WAVE file. */
export function isWav(buf: Buffer): boolean {
  return buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE";
}
