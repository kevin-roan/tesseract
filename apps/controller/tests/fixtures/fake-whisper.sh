#!/usr/bin/env bash
# Stand-in for `whisper-cli -m <model> -t <threads> -f <wav> -l <lang> -oj -of <base> -np -nt`.
# Writes <base>.json like whisper.cpp; the model file's content is the transcript
# plus the language argument ("silence" yields only a non-speech marker, "crash" fails,
# "threads" reports -t, "slow" takes 0.4 s and fails if another run overlaps it).
set -eu

model="" wav="" language="" base="" threads=""
while (($# > 0)); do
  case "$1" in
    -m) model="$2"; shift 2 ;;
    -t) threads="$2"; shift 2 ;;
    -f) wav="$2"; shift 2 ;;
    -l) language="$2"; shift 2 ;;
    -of) base="$2"; shift 2 ;;
    *) shift ;;
  esac
done

text="$(cat "$model")"
test -s "$wav"
if [[ "$text" == "crash" ]]; then
  echo "whisper: failed to load model" >&2
  exit 2
fi
if [[ "$text" == "threads" ]]; then
  text="threads=$threads"
fi
if [[ "$text" == "slow" ]]; then
  lock="$(dirname "$model")/.running"
  mkdir "$lock" 2>/dev/null || { echo "whisper: overlapping run" >&2; exit 3; }
  sleep 0.4
  rmdir "$lock"
fi
detected="$language"
if [[ "$language" == "auto" ]]; then
  detected="en"
fi
segments='{"offsets":{"from":0,"to":1000},"text":" [BLANK_AUDIO]"}'
if [[ "$text" != "silence" ]]; then
  segments='{"offsets":{"from":0,"to":1000},"text":" '"$text"'"},{"offsets":{"from":1000,"to":2000},"text":" (lang='"$language"')"}'
fi
printf '{"result":{"language":"%s"},"transcription":[%s]}\n' "$detected" "$segments" > "${base}.json"
