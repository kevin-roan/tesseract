import warnings

from .protocol import CHALLENGE_LENGTH, RfbError

KEY_LENGTH = 8

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
    from cryptography.hazmat.primitives.ciphers import Cipher, modes


def _reverse_bits(value: int) -> int:
    return int(f"{value:08b}"[::-1], 2)


REVERSED = bytes(_reverse_bits(value) for value in range(256))


def des_encrypt(key: bytes, data: bytes) -> bytes:
    if len(key) != KEY_LENGTH or len(data) % KEY_LENGTH:
        raise ValueError("DES needs an 8-byte key and 8-byte blocks")
    encryptor = Cipher(TripleDES(key * 3), modes.ECB()).encryptor()
    return encryptor.update(data) + encryptor.finalize()


def vnc_key(password: str) -> bytes:
    raw = password.encode("latin-1", errors="replace")[:KEY_LENGTH].ljust(KEY_LENGTH, b"\0")
    return raw.translate(REVERSED)


def vnc_auth_response(challenge: bytes, password: str) -> bytes:
    if len(challenge) != CHALLENGE_LENGTH:
        raise RfbError("VNC authentication challenge must be 16 bytes")
    return des_encrypt(vnc_key(password), bytes(challenge))
