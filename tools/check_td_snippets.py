#!/usr/bin/env python3
"""Fail when a function body duplicated between the technical design and
src/apps-script drifts.

The technical design is normative and embeds a few function bodies
verbatim; the sources carry the same bodies. Like the manifest and its
documented copy, the two must not disagree -- a fix landing in one place
leaves the other quietly wrong. Comments and whitespace are ignored; the
code must match.
"""
import re
import sys

TD = "docs/technical-design/technical-design.md"
PAIRS = {
    "defaultSettings_": "src/apps-script/Settings.js",
    "calculateWindow": "src/apps-script/ReconciliationEngine.js",
    "quantizeDuration": "src/apps-script/DrivetimeProvider.js",
    "onPrimaryCalendarChanged": "src/apps-script/Code.js",
    "runScheduledReconciliation": "src/apps-script/Code.js",
}


def body(text, name):
    head = "function " + name + "("
    start = text.find(head)
    if start < 0:
        return None
    end = text.find("\n}\n", start)
    if end < 0:
        return None
    snippet = text[start:end + 2]
    snippet = re.sub(r"//[^\n]*", "", snippet)
    return re.sub(r"\s+", " ", snippet).strip()


def main():
    td = open(TD, encoding="utf-8").read()
    failures = []
    for name, path in PAIRS.items():
        src = open(path, encoding="utf-8").read()
        in_td, in_src = body(td, name), body(src, name)
        if in_td is None:
            failures.append(f"{name}: not found in {TD}")
        elif in_src is None:
            failures.append(f"{name}: not found in {path}")
        elif in_td != in_src:
            failures.append(f"{name}: {path} differs from the {TD} snippet")
    for failure in failures:
        print(failure, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
