#!/usr/bin/env python3
"""Анализ трека для сценария клипа: темп, доли, энергия, структура, тональность, текст.

Пример:
    python analyze_audio.py song.mp3 -o analysis.json
    python analyze_audio.py song.mp3 --no-lyrics
    python analyze_audio.py song.mp3 --whisper-model medium --language uk
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

try:
    import librosa
except ImportError:  # понятная ошибка вместо трейсбэка
    sys.exit("Не установлен librosa: pip install librosa soundfile")

SR = 22050
HOP = 512
KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Профили Крумхансла для определения тональности
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


@dataclass
class Section:
    index: int
    start: float
    end: float
    label: str  # intro / verse / chorus / bridge / outro (эвристика по энергии и позиции)
    energy: float  # средняя энергия 0..1
    energy_level: str  # low / mid / high
    brightness: float  # 0..1, спектральный центроид (тёмный/яркий звук)


@dataclass
class LyricLine:
    start: float
    end: float
    text: str


@dataclass
class Analysis:
    file: str
    duration: float
    bpm: float
    beat_interval: float
    key: str
    mood_hint: str
    beats: list[float]
    downbeats: list[float]
    energy_per_second: list[float]
    peaks: list[float]  # моменты резкого роста энергии (дропы, входы припева)
    drops: list[float]  # моменты резкого спада (брейки, тишина)
    sections: list[Section]
    lyrics: list[LyricLine] = field(default_factory=list)
    lyrics_language: str | None = None
    notes: list[str] = field(default_factory=list)


def _norm(x: np.ndarray) -> np.ndarray:
    """Нормализация в 0..1 с защитой от деления на ноль."""
    lo, hi = float(np.min(x)), float(np.max(x))
    return np.zeros_like(x) if hi - lo < 1e-9 else (x - lo) / (hi - lo)


def _r(x: float, nd: int = 2) -> float:
    return round(float(x), nd)


def estimate_key(y: np.ndarray, sr: int) -> tuple[str, bool]:
    """Тональность по корреляции хромаграммы с профилями. Возвращает (название, минор ли)."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=HOP).mean(axis=1)
    best: tuple[float, str, bool] = (-np.inf, "C major", False)
    for i in range(12):
        for profile, minor in ((MAJOR_PROFILE, False), (MINOR_PROFILE, True)):
            corr = float(np.corrcoef(chroma, np.roll(profile, i))[0, 1])
            if corr > best[0]:
                best = (corr, f"{KEY_NAMES[i]} {'minor' if minor else 'major'}", minor)
    return best[1], best[2]


def _snap(t: float, grid: np.ndarray) -> float:
    """Притягивает время к ближайшей сильной доле (если сетка есть)."""
    return float(grid[np.argmin(np.abs(grid - t))]) if len(grid) else t


def segment_sections(y: np.ndarray, sr: int, duration: float, rms: np.ndarray,
                     centroid: np.ndarray, downbeats: np.ndarray, beat_interval: float) -> list[Section]:
    """Делит трек на части кластеризацией хромы+MFCC и подписывает их эвристикой."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=HOP)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=HOP, n_mfcc=13)
    feats = np.vstack([librosa.util.normalize(chroma, axis=1), librosa.util.normalize(mfcc, axis=1)])
    k = int(np.clip(round(duration / 14), 3, 16))  # ~одна часть на 12-16 секунд
    bounds = librosa.segment.agglomerative(feats, k)
    cand = sorted(_snap(float(t), downbeats) for t in librosa.frames_to_time(bounds, sr=sr, hop_length=HOP))

    # Минимальная длина части — 2 такта, но не меньше 4 секунд (убирает микрочасти)
    min_len = max(4.0, beat_interval * 8)
    times: list[float] = [0.0]
    for t in cand:
        if t - times[-1] >= min_len and duration - t >= min_len:
            times.append(t)
    times.append(duration)

    energy_all = _norm(rms)
    bright_all = _norm(centroid)
    raw: list[tuple[float, float, float, float]] = []
    for s, e in zip(times[:-1], times[1:]):
        a = librosa.time_to_frames(s, sr=sr, hop_length=HOP)
        b = max(a + 1, librosa.time_to_frames(e, sr=sr, hop_length=HOP))
        raw.append((s, e, float(energy_all[a:b].mean()), float(bright_all[a:b].mean())))

    # Уровни относительно самой громкой части (перцентили врут при малом числе частей)
    top = max(r[2] for r in raw) or 1.0
    hi_thr, lo_thr = top * 0.65, top * 0.35
    sections: list[Section] = []
    for i, (s, e, en, br) in enumerate(raw):
        level = "high" if en >= hi_thr else "low" if en <= lo_thr else "mid"
        if i == 0 and level != "high":
            label = "intro"
        elif i == len(raw) - 1 and level != "high":
            label = "outro"
        elif level == "high":
            label = "chorus"
        elif level == "low" and 0 < i < len(raw) - 1 and s > duration * 0.5:
            label = "bridge"
        else:
            label = "verse"
        prev = sections[-1] if sections else None
        if prev and prev.label == label and prev.energy_level == level:
            # Соседние одинаковые части сливаем, энергию усредняем по длительности
            w1, w2 = prev.end - prev.start, e - s
            prev.energy = _r((prev.energy * w1 + en * w2) / (w1 + w2))
            prev.brightness = _r((prev.brightness * w1 + br * w2) / (w1 + w2))
            prev.end = _r(e)
            continue
        sections.append(Section(len(sections), _r(s), _r(e), label, _r(en), level, _r(br)))
    return sections


def find_changes(energy_sec: np.ndarray) -> tuple[list[float], list[float]]:
    """Ищет резкие подъёмы и спады энергии (сглаженная производная)."""
    if len(energy_sec) < 4:
        return [], []
    smooth = np.convolve(energy_sec, np.ones(2) / 2, mode="same")
    diff = np.diff(smooth)
    thr = max(0.15, float(np.std(diff)) * 2.0)
    peaks, drops = [], []
    for i, d in enumerate(diff):
        t = float(i + 1)
        if d > thr and (not peaks or t - peaks[-1] > 4):
            peaks.append(t)
        elif d < -thr and (not drops or t - drops[-1] > 4):
            drops.append(t)
    return peaks, drops


def transcribe(path: Path, model_size: str, language: str | None) -> tuple[list[LyricLine], str | None]:
    """Снимает текст песни через faster-whisper (локально, CPU, int8)."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise RuntimeError("Не установлен faster-whisper: pip install faster-whisper")
    model = WhisperModel(model_size, device="auto", compute_type="int8")
    segments, info = model.transcribe(str(path), language=language, vad_filter=True, beam_size=5)
    lines = [LyricLine(_r(s.start), _r(s.end), s.text.strip()) for s in segments if s.text.strip()]
    return lines, info.language


def analyze(path: Path, lyrics: bool, model_size: str, language: str | None) -> Analysis:
    y, sr = librosa.load(str(path), sr=SR, mono=True)
    duration = float(len(y) / sr)
    if duration < 5:
        raise ValueError("Трек короче 5 секунд — анализировать нечего")

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=HOP)
    bpm = float(np.atleast_1d(tempo)[0])
    beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP)

    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=HOP)[0]

    # Сильная доля: из каждых 4 долей выбираем фазу с максимальной суммарной атакой
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    downbeats: list[float] = []
    if len(beat_frames) >= 8:
        strengths = onset_env[np.clip(beat_frames, 0, len(onset_env) - 1)]
        phase = int(np.argmax([strengths[p::4].sum() for p in range(4)]))
        downbeats = [_r(t) for t in beats[phase::4]]

    # Энергия по секундам (0..1)
    frames_per_sec = sr / HOP
    n_sec = int(np.ceil(duration))
    energy_sec = np.array([
        rms[int(i * frames_per_sec): max(int(i * frames_per_sec) + 1, int((i + 1) * frames_per_sec))].mean()
        for i in range(n_sec)
    ])
    energy_sec = _norm(energy_sec)
    peaks, drops = find_changes(energy_sec)

    key, is_minor = estimate_key(y, sr)
    sections = segment_sections(y, sr, duration, rms, centroid,
                                np.array(downbeats, dtype=float), 60 / bpm if bpm else 0.5)

    tempo_word = "медленный" if bpm < 85 else "средний" if bpm < 120 else "быстрый"
    mood = f"{tempo_word} темп, {'минор — меланхолия/драма/напряжение' if is_minor else 'мажор — светлое/энергичное настроение'}"

    result = Analysis(
        file=path.name, duration=_r(duration), bpm=_r(bpm, 1),
        beat_interval=_r(60 / bpm if bpm else 0, 3), key=key, mood_hint=mood,
        beats=[_r(t) for t in beats], downbeats=downbeats,
        energy_per_second=[_r(v) for v in energy_sec], peaks=peaks, drops=drops, sections=sections,
    )
    result.notes.append("Метки частей (intro/verse/chorus...) — эвристика по энергии, проверяй по тексту песни.")
    if bpm > 160 or bpm < 60:
        result.notes.append(f"BPM {bpm:.0f} может быть удвоен/ополовинен — проверь на слух.")

    if lyrics:
        try:
            result.lyrics, result.lyrics_language = transcribe(path, model_size, language)
            if not result.lyrics:
                result.notes.append("Вокал не распознан — возможно, инструментал.")
        except Exception as exc:  # анализ ритма ценен и без текста
            result.notes.append(f"Транскрипция не удалась: {exc}")
    return result


def main() -> None:
    p = argparse.ArgumentParser(description="Анализ MP3 для сценария клипа")
    p.add_argument("audio", type=Path, help="Путь к MP3/WAV/M4A/FLAC")
    p.add_argument("-o", "--output", type=Path, help="Куда сохранить JSON (по умолчанию <имя>.analysis.json)")
    p.add_argument("--no-lyrics", action="store_true", help="Не распознавать текст")
    p.add_argument("--whisper-model", default="small", help="tiny/base/small/medium/large-v3 (по умолчанию small)")
    p.add_argument("--language", default=None, help="Язык песни (uk, ru, en...). По умолчанию — автоопределение")
    args = p.parse_args()

    if not args.audio.is_file():
        sys.exit(f"Файл не найден: {args.audio}")
    out = args.output or args.audio.with_suffix(".analysis.json")
    try:
        result = analyze(args.audio, not args.no_lyrics, args.whisper_model, args.language)
    except Exception as exc:
        sys.exit(f"Ошибка анализа: {exc}")

    data: dict[str, Any] = asdict(result)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    # Короткая сводка в консоль — её Claude читает первой
    print(f"OK → {out}")
    print(f"Длительность {result.duration}s | BPM {result.bpm} | доля {result.beat_interval}s | {result.key}")
    print(f"Настроение: {result.mood_hint}")
    for s in result.sections:
        print(f"  [{s.start:>6.1f}–{s.end:>6.1f}] {s.label:<7} энергия {s.energy:.2f} ({s.energy_level})")
    print(f"Пики энергии: {result.peaks}")
    print(f"Спады: {result.drops}")
    print(f"Строк текста: {len(result.lyrics)} ({result.lyrics_language or '—'})")
    for n in result.notes:
        print(f"! {n}")


if __name__ == "__main__":
    main()
