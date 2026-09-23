"""Generate the private demo narration with a local Kokoro voice model.

Install requirements-demo-voice.txt and download the Kokoro v1.0 ONNX model
and voices file into artifacts/tts-model before running this script.
"""

import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
MODEL_DIR = ARTIFACTS / "tts-model"
NARRATION = ROOT / "docs" / "demo-narration.md"
VOICE = "af_heart"
PAUSE_SECONDS = 0.4


def paragraphs():
    lines = NARRATION.read_text(encoding="utf-8").splitlines()
    return [
        line.strip()
        for line in lines
        if line.strip() and not line.startswith("#") and not line.startswith("Target length:")
    ]


def main():
    model = MODEL_DIR / "kokoro-v1.0.onnx"
    voices = MODEL_DIR / "voices-v1.0.bin"
    if not model.is_file() or not voices.is_file():
        raise SystemExit("Download the Kokoro model and voices to artifacts/tts-model first (see docs/demo.md).")

    tts = Kokoro(str(model), str(voices))
    clips = []
    timing = []
    elapsed = 0.0
    sample_rate = None

    for paragraph in paragraphs():
        # Each paragraph is long enough to preserve the voice's natural prosody.
        samples, current_rate = tts.create(paragraph, voice=VOICE, speed=1.0, lang="en-us")
        if sample_rate is not None and current_rate != sample_rate:
            raise RuntimeError("The voice model changed sample rate between paragraphs.")
        sample_rate = current_rate
        start = elapsed
        elapsed += len(samples) / sample_rate
        timing.append({"text": paragraph, "start": start, "end": elapsed})
        clips.append(samples)
        clips.append(np.zeros(round(PAUSE_SECONDS * sample_rate), dtype=samples.dtype))
        elapsed += PAUSE_SECONDS

    ARTIFACTS.mkdir(exist_ok=True)
    audio = np.concatenate(clips[:-1])
    wav_path = ARTIFACTS / "demo-narration.wav"
    normalized_path = ARTIFACTS / "demo-narration-normalized.wav"
    sf.write(wav_path, audio, sample_rate)
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
            "-af", "loudnorm=I=-18:TP=-2:LRA=9", "-ar", str(sample_rate),
            "-ac", "1", str(normalized_path),
        ],
        check=True,
    )
    normalized_path.replace(wav_path)
    (ARTIFACTS / "demo-voice-timing.json").write_text(json.dumps(timing, indent=2), encoding="utf-8")
    print(f"{len(audio) / sample_rate:.2f} seconds; voice {VOICE}")


if __name__ == "__main__":
    main()
