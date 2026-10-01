#!/usr/bin/env bash
# Stand-in for `ffmpeg … -i <input> … -y <output.wav>`: writes a 44-byte header plus
# 1.5 s of 16 kHz mono s16le silence. An input named *.bad fails like undecodable audio.
set -eu

input="" output="${*: -1}"
while (($# > 0)); do
  if [[ "$1" == "-i" ]]; then input="$2"; fi
  shift
done
if [[ "$input" == *.bad ]]; then
  echo "Invalid data found when processing input" >&2
  exit 1
fi
head -c $((44 + 48000)) /dev/zero > "$output"
