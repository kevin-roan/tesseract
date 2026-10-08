import random
from collections.abc import Iterable

ADJECTIVES = (
    "amber", "autumn", "bold", "brave", "breezy", "bright", "calm", "clever", "cosmic", "cozy",
    "crisp", "dapper", "dawn", "dusky", "eager", "early", "fancy", "fluffy", "frosty", "gentle",
    "giddy", "glad", "golden", "grand", "happy", "hazy", "humble", "jolly", "keen", "kind",
    "lively", "lucky", "lunar", "mellow", "merry", "misty", "morning", "mossy", "nimble", "noble",
    "olive", "patient", "plucky", "polite", "proud", "quick", "quiet", "rapid", "rosy", "rustic",
    "sandy", "silent", "silver", "sleepy", "snowy", "solar", "sunny", "swift", "tidy", "velvet",
    "vivid", "warm", "wild", "windy", "witty", "zesty",
)

NOUNS = (
    "acorn", "badger", "beacon", "birch", "bison", "brook", "canyon", "cat", "cedar", "comet",
    "coral", "crane", "creek", "dolphin", "dove", "falcon", "fern", "finch", "fox", "gecko",
    "harbor", "hare", "hazel", "heron", "hill", "island", "koala", "lagoon", "lark", "lemur",
    "lotus", "lynx", "maple", "meadow", "meteor", "moose", "moth", "newt", "oak", "orca",
    "otter", "owl", "panda", "pebble", "pine", "plover", "pond", "puffin", "quail", "raven",
    "reef", "river", "robin", "sparrow", "spruce", "stone", "swan", "thistle", "tiger", "trout",
    "tulip", "walrus", "willow", "wren", "yak", "zebra",
)


def pseudonym(taken: Iterable[str] = (), rng: random.Random | None = None) -> str:
    used = set(taken)
    rng = rng or random.SystemRandom()
    pairs = [f"{adjective}-{noun}" for adjective in ADJECTIVES for noun in NOUNS]
    rng.shuffle(pairs)
    free = next((pair for pair in pairs if pair not in used), None)
    if free is not None:
        return free
    base, suffix = pairs[0], 2
    while f"{base}-{suffix}" in used:
        suffix += 1
    return f"{base}-{suffix}"
