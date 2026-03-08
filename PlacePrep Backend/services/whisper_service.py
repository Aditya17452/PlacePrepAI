import tempfile, os, asyncio

def transcribe_complete(audio_bytes: bytes) -> dict:
    tmp = None
    try:
        from groq import Groq
        from core.config import settings

        # Detect format from magic bytes
        if audio_bytes[:4] == b'RIFF':
            suffix = ".wav"
        elif audio_bytes[:4] == b'OggS':
            suffix = ".ogg"
        elif audio_bytes[:3] == b'ID3' or audio_bytes[:2] == b'\xff\xfb':
            suffix = ".mp3"
        else:
            suffix = ".webm"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            tmp = f.name

        print(f"📁 Audio file: {len(audio_bytes)} bytes, format: {suffix}")

        # If webm still fails, try converting with pydub
        if suffix == ".webm":
            try:
                from pydub import AudioSegment
                wav_tmp = tmp.replace(".webm", ".wav")
                audio = AudioSegment.from_file(tmp, format="webm")
                audio.export(wav_tmp, format="wav")
                os.unlink(tmp)
                tmp = wav_tmp
                print(f"✅ Converted webm→wav: {tmp}")
            except Exception as conv_err:
                print(f"⚠️ webm conversion failed: {conv_err}, trying raw...")

        client = Groq(api_key=settings.GROQ_API_KEY)
        with open(tmp, "rb") as af:
            result = client.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=af,
                language="en"
            )

        text = result.text.strip() if result.text else ""
        print(f"🎙 Transcribed: '{text[:100]}'")
        return {"text": text, **_calc_stats(text)}

    except Exception as e:
        print(f"❌ Transcription error: {e}")
        import traceback
        traceback.print_exc()
        return {"text": "", "word_count": 0, "filler_count": 0, "wpm": 0}
    finally:
        if tmp:
            try: os.unlink(tmp)
            except: pass


FILLERS = ["um", "uh", "like", "you know", "basically", "literally", "so", "right"]

def _calc_stats(text: str) -> dict:
    words = text.lower().split()
    filler_count = sum(text.lower().count(f) for f in FILLERS)
    return {"word_count": len(words), "filler_count": filler_count, "wpm": 0}