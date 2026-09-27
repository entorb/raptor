// WAV buffer -> Ogg Vorbis file through ffmpeg-static (FFMPEG_BIN overrides the binary).
import { execFileSync } from "node:child_process"
import { rmSync, writeFileSync } from "node:fs"
import ffmpeg from "ffmpeg-static"

export function toOgg(wavBuf, out, quality) {
  const tmp = `${out}.wav`
  writeFileSync(tmp, wavBuf)
  execFileSync(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    tmp,
    "-c:a",
    "libvorbis",
    "-q:a",
    quality,
    out,
  ])
  rmSync(tmp)
}
