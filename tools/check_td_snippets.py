#!/usr/bin/env python3
"""Fail when a function body, an enum, or a cap duplicated between the
technical design and src/apps-script drifts.

The technical design is normative and embeds a few function bodies
verbatim; the sources carry the same bodies. Like the manifest and its
documented copy, the two must not disagree -- a fix landing in one place
leaves the other quietly wrong. Comments and whitespace are ignored; the
code must match. The 4.5 EligibilityReason enum must equal the
ELIGIBILITY_REASONS array verbatim and in order; SYNTHESIS_REASONS must
equal the 4.5 parenthetical list and be a subset of the enum; and each
9.3 cap literal and each 11.1 route-input cap literal ("`NAME` (n)")
must equal its Constants.js value (the prose refers to caps by name, so
the one literal per cap is the only numeral to keep in step); the
route-input caps must also match the routing broker's README, which
enforces them on the other side of the wire.
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
REASONS_SRC = "src/apps-script/Eligibility.js"
CAPS_SRC = "src/apps-script/Constants.js"
CAPS = [
    "MAX_TITLE_PATTERN_LENGTH",
    "MAX_TITLE_PATTERN_QUANTIFIERS",
    "MAX_TITLE_PATTERN_ALTERNATIONS",
    "MAX_TITLE_PATTERN_SUBJECT_CHARS",
    "MAX_ROUTE_ENDPOINT_VALUE_CHARS",
    "MAX_ROUTE_REQUEST_BODY_BYTES",
]
# Caps the routing broker enforces too: its README must state the same
# literal ("`NAME` (n)"), since the client's step-0 cap only keeps
# over-long inputs off the wire while the two agree.
BROKER_README = "cloud/routing-broker/README.md"
BROKER_CAPS = [
    "MAX_ROUTE_ENDPOINT_VALUE_CHARS",
    "MAX_ROUTE_REQUEST_BODY_BYTES",
]


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


def enum_in_td(td):
    start = td.find("ELIGIBLE_OUT_OF_OFFICE\nELIGIBLE_TITLE_PATTERN")
    end = td.find("```", start) if start >= 0 else -1
    if start < 0 or end < 0:
        return None
    return td[start:end].split()


def synthesis_in_td(td):
    match = re.search(r"`SYNTHESIS_REASONS`[^(]*\(([^)]*)\)", td)
    return re.findall(r"`([A-Z_]+)`", match.group(1)) if match else None


def frozen_array(src, name):
    match = re.search(name + r" = Object\.freeze\(\[(.*?)\]\)", src, re.S)
    return re.findall(r"'([A-Z_]+)'", match.group(1)) if match else None


def enum_in_src(src):
    return frozen_array(src, "ELIGIBILITY_REASONS")


def main():
    td = open(TD, encoding="utf-8").read()
    failures = []
    reasons_src = open(REASONS_SRC, encoding="utf-8").read()
    td_enum, src_enum = enum_in_td(td), enum_in_src(reasons_src)
    if td_enum is None or src_enum is None:
        failures.append("EligibilityReason enum: not found in both places")
    elif td_enum != src_enum:
        failures.append(
            f"EligibilityReason enum: {REASONS_SRC} differs from {TD} 4.5")
    td_synth = synthesis_in_td(td)
    src_synth = frozen_array(reasons_src, "SYNTHESIS_REASONS")
    if td_synth is None or src_synth is None:
        failures.append("SYNTHESIS_REASONS: not found in both places")
    elif td_synth != src_synth:
        failures.append(
            f"SYNTHESIS_REASONS: {REASONS_SRC} differs from the {TD} 4.5 list")
    elif not set(src_synth) <= set(src_enum or []):
        failures.append(
            "SYNTHESIS_REASONS: not a subset of ELIGIBILITY_REASONS")
    caps_src = open(CAPS_SRC, encoding="utf-8").read()
    for cap in CAPS:
        in_td = re.search(r"`" + cap + r"` \((\d+)\)", td)
        in_src = re.search(r"const " + cap + r" = (\d+);", caps_src)
        if not in_td or not in_src:
            failures.append(f"{cap}: literal not found in both places")
        elif in_td.group(1) != in_src.group(1):
            failures.append(
                f"{cap}: {CAPS_SRC} has {in_src.group(1)}, {TD} says {in_td.group(1)}")
    readme = open(BROKER_README, encoding="utf-8").read()
    for cap in BROKER_CAPS:
        in_readme = re.search(r"`" + cap + r"` \((\d+)\)", readme)
        in_src = re.search(r"const " + cap + r" = (\d+);", caps_src)
        if not in_readme or not in_src:
            failures.append(f"{cap}: literal not found in {BROKER_README}")
        elif in_readme.group(1) != in_src.group(1):
            failures.append(
                f"{cap}: {CAPS_SRC} has {in_src.group(1)}, "
                f"{BROKER_README} says {in_readme.group(1)}")
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
