"""A small validator for the JSON Schema subset the agents use.

One schema dict is both the tool definition the model sees and the check its input must pass, so the
two can never drift apart. Supported: type (object, array, string, number, integer, boolean), properties,
required, enum, minLength (after trimming when "x-trim" is set), minimum, maximum,
items, default, and "x-require-if" for cross-field rules. Defaults are filled in; keys an object schema
does not list are dropped, and an object schema without properties passes its value through unchanged.
"""
from __future__ import annotations

from typing import Any


class ValidationError(ValueError):
    def __init__(self, issues: list[str]):
        super().__init__("; ".join(issues))
        self.issues = issues


_TYPES: dict[str, Any] = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
}


def validate(schema: dict[str, Any], value: Any) -> Any:
    """Returns the cleaned value (defaults applied, strings trimmed where asked) or raises ValidationError."""
    issues: list[str] = []
    cleaned = _check(schema, value, [], issues)
    if issues:
        raise ValidationError(issues)
    return cleaned


def _where(path: list[str | int]) -> str:
    return ".".join(str(p) for p in path) or "input"


def _check(schema: dict[str, Any], value: Any, path: list[str | int], issues: list[str]) -> Any:
    kind = schema.get("type")
    if kind and not _TYPES[kind](value):
        issues.append(f"{_where(path)}: expected {kind}")
        return value
    if "enum" in schema and value not in schema["enum"]:
        issues.append(f"{_where(path)}: expected one of {', '.join(map(str, schema['enum']))}")
        return value

    if kind == "string":
        if schema.get("x-trim"):
            value = value.strip()
        if len(value) < schema.get("minLength", 0):
            issues.append(f"{_where(path)}: too short")
    elif kind in ("number", "integer"):
        if "minimum" in schema and value < schema["minimum"]:
            issues.append(f"{_where(path)}: must be at least {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            issues.append(f"{_where(path)}: must be at most {schema['maximum']}")
    elif kind == "array":
        item = schema.get("items")
        if item:
            value = [_check(item, v, [*path, i], issues) for i, v in enumerate(value)]
    elif kind == "object" and "properties" in schema:
        props: dict[str, Any] = schema.get("properties", {})
        out: dict[str, Any] = {}
        for key, sub in props.items():
            if key in value and value[key] is not None:
                out[key] = _check(sub, value[key], [*path, key], issues)
            elif "default" in sub:
                out[key] = sub["default"]
            elif key in schema.get("required", []):
                issues.append(f"{_where([*path, key])}: required")
        for rule in schema.get("x-require-if", []):
            if out.get(rule["field"]) == rule["equals"] and not out.get(rule["require"]):
                issues.append(f"{_where([*path, rule['require']])}: {rule['message']}")
        value = out
    return value


def public_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """The schema as the model sees it: our x- extensions removed."""
    if isinstance(schema, dict):
        return {k: public_schema(v) for k, v in schema.items() if not k.startswith("x-")}
    if isinstance(schema, list):
        return [public_schema(v) for v in schema]
    return schema
