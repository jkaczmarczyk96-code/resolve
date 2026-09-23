"""Conservative secret scan of every blob reachable in Git history.

Prints only pattern names and file paths, never matching values. This does not
replace a managed secret-scanning service, but catches common accidental keys
before making a repository public.
"""

import re
import subprocess
import sys


PATTERNS = {
    "private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "OpenAI-style key": re.compile(rb"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "GitHub token": re.compile(rb"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    "Google API key": re.compile(rb"\bAIza[0-9A-Za-z_-]{25,}\b"),
    "Tavily key": re.compile(rb"\btvly-[A-Za-z0-9_-]{16,}\b"),
}
ASSIGNMENT = re.compile(
    rb"(?m)^\s*(NEBIUS_API_KEY|TAVILY_API_KEY|SUPABASE_SERVICE_ROLE_KEY|"
    rb"GOOGLE_CLIENT_SECRET|SMTP_PASSWORD|ENCRYPTION_KEY)\s*=\s*([^\s#]+)"
)


def is_placeholder(value):
    value = value.lower().strip(b"\"'")
    return (
        value.startswith(b"<")
        or value in {b"...", b"example", b"changeme", b"placeholder"}
        or b"your" in value
        or b"replace" in value
        or b"placeholder" in value
    )


def main():
    objects = subprocess.check_output(["git", "rev-list", "--objects", "--all"])
    entries = [line.split(b" ", 1) for line in objects.splitlines()]
    findings = set()
    blobs = 0
    with subprocess.Popen(
        ["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE
    ) as process:
        for entry in entries:
            oid = entry[0]
            path = entry[1].decode("utf-8", "replace") if len(entry) > 1 else "(unnamed)"
            process.stdin.write(oid + b"\n")
            process.stdin.flush()
            header = process.stdout.readline().split()
            if len(header) < 3:
                raise RuntimeError("Unexpected git cat-file output")
            size = int(header[2])
            data = process.stdout.read(size)
            process.stdout.read(1)
            if header[1] != b"blob" or b"\0" in data[:4096]:
                continue
            blobs += 1
            for label, pattern in PATTERNS.items():
                if pattern.search(data):
                    findings.add((label, path))
            for match in ASSIGNMENT.finditer(data):
                if not is_placeholder(match[2]):
                    findings.add(("configured secret assignment", path))
        process.stdin.close()
        process.wait()

    if findings:
        for label, path in sorted(findings):
            print(f"{label}: {path}")
        print(f"Found {len(findings)} possible secret exposures in {blobs} text blobs.")
        return 1
    print(f"No high-confidence secret patterns found in {blobs} text blobs across Git history.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
